# Stories Feature - Implementation Plan

## What is Stories

A graded reader mode where stories are written in Chinese and progressively
reveal themselves to the user based on what they have already learned in
practice mode. A complete beginner sees natural English. An intermediate learner
sees a mix of English words replaced by Pinyin. An expert sees mostly Hanzi with
a few Pinyin words remaining.

The transformation happens word-by-word on the English-to-Pinyin axis, driven by
the user's `learned` state from normal practice. It then continues word-by-word
on the Pinyin-to-Hanzi axis, driven by a new `hanziLearned` state the user sets
manually while reading.

**Implementation correction:** Story content should move out of the database
and into version-controlled JSON files. The existing SQL-backed story content
design below is current/legacy context until it is refactored. AI has struggled
to create and repair stories reliably, so JSON should be the source of truth for
story text and word mappings because it is easier to diff, review, and edit
manually. Keep the database for user-specific progress/state.

---

## Data Model

### Changes to existing tables

Add two columns to `user_word_state`:

```
hanzi_learned     boolean   default false
hanzi_learned_at  timestamp nullable
```

### New table: `stories`

```
id              integer  PK auto-increment
title           text     e.g. "A Day at the Market"
title_english   text     English title
hsk_level       integer  1-6
description     text     nullable, short teaser for the listing page
created_at      timestamp
```

No `hanzi_text` column - the full Chinese text is reconstructable from
`story_sentences.chinese` joined in order.

### New table: `story_sentences`

```
id        integer  PK auto-increment
story_id  integer  FK -> stories
position  integer  ordering within the story
chinese   text     full sentence in Hanzi: "我去了商店。"
english   text     natural English translation: "I went to the store."
```

### New table: `word_map`

Shared dictionary across all stories. Grows over time so that each new story
requires less authoring effort.

```
id  integer  PK auto-increment
en  text     UNIQUE - the English word or phrase: "went", "store", "An"
zh  text     comma-separated Hanzi lookups: "去,了" or "商店" or "一,个"
```

`zh` is split on `,` at runtime. Each segment is looked up in the `vocabulary`
table by `hanzi` column (`ORDER BY hsk_level LIMIT 1`) to get its `pinyin` and
user `learned`/`hanziLearned` state.

### New table: `sentence_words`

Links which `word_map` entries apply to a given sentence. One row per unique
word per sentence (not one row per occurrence).

```
sentence_id  integer  composite PK  FK -> story_sentences
word_map_id  integer  composite PK  FK -> word_map
```

### Concrete example

Story: "I went to the store. What did I see? An apple."

`stories` row:

```
title: "At the Market", hsk_level: 1
```

`story_sentences` rows:

```
position 0: chinese="我去了商店。"        english="I went to the store."
position 1: chinese="我看见了什么？"      english="What did I see?"
position 2: chinese="一个苹果。"          english="An apple."
```

`word_map` rows (shared, reused by future stories):

```
{ en: "I",     zh: "我" }
{ en: "went",  zh: "去,了" }
{ en: "store", zh: "商店" }
{ en: "What",  zh: "什么" }
{ en: "see",   zh: "看见" }
{ en: "An",    zh: "一,个" }
{ en: "apple", zh: "苹果" }
```

`sentence_words` rows:

```
(sentence 0, word_map "I")
(sentence 0, word_map "went")
(sentence 0, word_map "store")
(sentence 1, word_map "What")
(sentence 1, word_map "I")
(sentence 1, word_map "see")
(sentence 2, word_map "An")
(sentence 2, word_map "apple")
```

Words like "to the" and "did" have no entry - they render as plain unlinked text.

---

## Display Logic

### Per-word state (applied to each `word_map` entry in a sentence)

The zh string is split into individual Hanzi lookups. Each is checked against
the user's `user_word_state`.

```
any zh segment not learned        -> show en    (blue/bold, clickable)
all zh segments learned           -> show Pinyin (blue/bold, clickable)
all zh segments hanziLearned      -> show Hanzi  (blue/bold, clickable)
```

Words with no `word_map` entry render as plain unformatted text.

### Sentence-level final flip

When ALL `word_map` entries in a sentence have all their zh segments in
`learned` state: the sentence stops rendering word-by-word and switches to
displaying `story_sentences.chinese` directly (the full Hanzi sentence, with
per-word hanziLearned state still applied to individual spans within it).

This final flip can change word order noticeably since English and Chinese
sentence structure differ. This is intentional and acceptable - the user has
already learned every word in the sentence at that point.

### Preview modes (session-only, not saved)

Two toggle buttons in the reader controls:

- "Show Pinyin" - override all sentences to render tokens in Pinyin regardless
  of learned state. Used to preview what the story looks like in full Pinyin.
- "Show Hanzi" - override all sentences to show `story_sentences.chinese`
  directly. Used as a reading challenge for advanced users.

---

## Routes and Components

```
/stories                       - story browser
/stories/[id]                  - story reader
POST /api/story-hanzi          - toggle hanziLearned on/off for a word
POST /api/story-word-learned   - toggle learned on/off for a word
POST /api/story-question       - ask AI about selected words
```

### `/stories` listing

- Grid of story cards filtered by HSK level
- Each card: title, Chinese title, HSK badge, description, word count, start button

### `/stories/[id]` server load

1. Load story + sentences in order
2. Collect all `word_map` entries for those sentences via `sentence_words`
3. Split each `word_map.zh` on `,`, collect all unique Hanzi
4. Query `vocabulary` for those Hanzi (id, hanzi, pinyin, english, hskLevel)
5. Query `user_word_state` for current user + those vocab IDs
6. Return: story, sentences with their word mappings, vocabMap, stateMap

No client-side API calls needed on initial load.

### Component breakdown

```
/stories/[id]/+page.svelte
  StoryControls     - toggle bar, progress stats, question mode button
  StoryText         - renders all sentences
    SentenceRow     - single sentence: english or chinese mode + inline spans
  WordPopup         - floating detail popup on click
  QuestionPanel     - AI question input, slides in from bottom
```

---

## Interactions

### Highlighting

Words with `word_map` entries are rendered as `<span class="story-word">`.
They are visually distinguished (blue text, slight underline) so the user
knows they are interactive. Words with no mapping render as plain text.

### Click / tap

Single click or tap on a blue word:

- If sentence is currently showing English: show `story_sentences.chinese` as
  a translation hint (small card below the sentence, dismissible)
- If sentence is currently showing Chinese (post-flip): show
  `story_sentences.english` as a translation hint

### Double-click / long press (mobile)

Opens a `WordCard` for that specific word. This is a custom Svelte component
positioned near the tapped word (viewport-aware so it never clips off-screen
edges), dismissed by clicking outside or pressing Escape. Not a DaisyUI tooltip.

Card contents:

- Hanzi in large type (~48px), bold
- Pinyin in muted gray below
- English definition (first meaning only) below that
- HSK level badge

Action buttons shown conditionally:

| Condition                    | Button shown                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------- |
| word not yet learned         | "Mark as learned" - sets `learned = true` for all zh vocab IDs                |
| word is learned              | "Mark as forgotten" - sets `learned = false`, word reverts to English display |
| learned but not hanziLearned | "I know this character" - sets `hanziLearned = true`                          |
| hanziLearned                 | "Unlearn character" - sets `hanziLearned = false`, reverts to Pinyin display  |

All state changes are optimistic: the story updates immediately, then the
relevant API endpoint is called. Setting `learned = false` also reverts the
word across the whole story and returns it to the practice queue.

"Add to practice" link at the bottom navigates to `/practice?hsk=N` filtered
to the word's HSK level.

### "I know this character" / learned toggle flow

All word state changes from the `WordCard` follow the same pattern:

1. Optimistic update: all spans for that `word_map` entry across the story
   re-derive their display mode immediately from the new state
2. API call fires in the background:
   - `POST /api/story-word-learned` with `{ vocabIds, learned: boolean }`
   - `POST /api/story-hanzi` with `{ vocabIds, hanziLearned: boolean }`
3. Progress bar in the controls header updates live
4. Animated micro-transition on affected spans (scale pop, ~150ms)

On failure the optimistic update is rolled back and a toast error is shown.

### AI question mode

A question-mark button in the controls bar enters question mode. In this mode:

- The reader gets a subtle background tint to indicate active mode
- Tapping any blue word toggles it "selected" (yellow highlight)
- When one or more words are selected, an "Ask AI" bar appears pinned at the
  bottom of the screen
- User types a question, submits
- The `QuestionPanel` slides up with the AI answer (Markdown rendered)
- "Clear" button exits question mode and deselects all words

Multi-word selection allows questions like "why do these two words appear
together here?"

---

## AI Integration

### `POST /api/story-question`

Request:

```ts
{
  storyId: number
  selectedWordMapIds: number[]
  contextChinese: string   // the sentence(s) containing the selection
  contextEnglish: string   // English translation of those sentences
  question: string
}
```

Response:

```ts
{
	answer: string;
} // Markdown, 2-4 sentences
```

Model: `gpt-4.1-mini`

System prompt includes: story HSK level, selected words with all three forms
(en/pinyin/hanzi), surrounding sentence for grammar context. Instructions: answer
in 2-4 sentences, assume learner knows HSK 1-N vocabulary, focus on the "why"
not a dictionary definition. Use `store: false`.

---

## Visual Design

### Token visual states

| State                       | Text Style        | Background | Font         |
| --------------------------- | ----------------- | ---------- | ------------ |
| English                     | slate-400, italic | none       | sans-serif   |
| Pinyin                      | default weight    | none       | sans-serif   |
| Hanzi                       | slightly heavier  | none       | `font-serif` |
| Selected (question mode)    | default           | yellow-200 | -            |
| Temporarily revealed Pinyin | default           | blue-50    | -            |

All mapped words (English, Pinyin, or Hanzi) carry a subtle blue tint and a
slight underline to signal interactivity. Unmapped plain-text words have no
decoration.

### Spacing

Each mapped word span is `inline`. A non-breaking space is injected before
each span when in English or Pinyin mode so words separate naturally. In Hanzi
mode no space is injected - Chinese characters sit directly adjacent to each
other. Punctuation arrives from the `chinese` / `english` strings and handles
its own spacing.

### Word detail card (`WordCard` component)

A custom Svelte component, not a DaisyUI tooltip. Positioned near the tapped
word with CSS (absolute, then clamped to viewport bounds so it never clips).
Dismissed by clicking outside or pressing Escape.

See the Interactions section for full card contents and button logic.

### Hover tooltip (desktop only)

On hover (before any click), a small non-interactive tooltip shows all three
forms inline: `汉字 • hàn zì • Chinese character`. Lightweight CSS-only
implementation (DaisyUI `tooltip` attribute or `::after` pseudo-element).
Does not appear on touch devices.

### Progress bar

A horizontal bar in the controls area, split into three live-updating segments:

- **Slate** - words not yet learned (English display)
- **Blue** - words learned, not yet hanziLearned (Pinyin display)
- **Green** - words with hanziLearned (Hanzi display)

Calculated from unique `word_map` entries referenced in the story, not raw
word occurrences - "I" appearing ten times counts as one word in the stats.
Updates immediately on every learned/hanziLearned toggle.

---

## Navigation Changes

Add "Stories" to both nav bars.

**Desktop:** insert between "Map" and "Practice" in the top nav. Icon: `BookOpen`
from lucide-svelte.

**Mobile bottom nav:** replace "Map" with "Stories". Map remains accessible from
desktop nav. Stories is a more frequently used daily feature than the map.

---

## Side Quest: AI Story Creation Pipeline

`scripts/create-story.ts` - creates a new story with minimal human supervision.

Usage:

```
bun scripts/create-story.ts --hsk 1 --topic "daily routine"
bun scripts/create-story.ts --hsk 2 --topic "visiting a friend"
```

### Step 1: Generate Hanzi story

Prompt AI with: HSK level N, topic, target length (HSK1: ~80 chars, HSK2: ~150
chars, +50 per level), vocabulary constraints.

System prompt instructs AI to use ONLY vocabulary from HSK levels 1-N and to
return raw Hanzi text only, no Pinyin, no translation.

**Automated check A - vocabulary compliance:**
Segment the Hanzi text using the vocabulary table (longest-match scan). Any
character or substring that does not match a vocabulary entry at HSK <= N is
flagged. If flagged words exceed 5% of total, reject and retry (max 3 attempts),
passing the flagged words back to the AI so it knows to avoid them.

**Automated check B - story integrity:**

- Minimum 3 sentences
- No sentence longer than 40 characters
- Story contains at least 5 distinct vocabulary words

### Step 2: Generate sentence structure

For each sentence in the story, call AI to produce:

```json
{
	"chinese": "我去了商店。",
	"english": "I went to the store.",
	"words": [
		{ "en": "I", "zh": "我" },
		{ "en": "went", "zh": "去,了" },
		{ "en": "store", "zh": "商店" }
	]
}
```

Rules given to AI:

- Include only words that have a meaningful Chinese equivalent
- Do not leave simple grammar words floating around untranslated. Words such as
  "and", "is", "are", and "will" should be translated or absorbed into a mapped
  phrase whenever they appear in the English sentence.
- If the English says "the <word>", include "the" in the mapped English phrase
  instead of mapping only `<word>`. Example: map "the teacher", not just
  "teacher".
- If the English says "to <verb>", include "to" in the mapped English phrase
  instead of mapping only `<verb>`. Example: map "to study", not just "study".
- Prefer contiguous English phrases that appear exactly in the sentence. Avoid
  mappings that leave orphaned words like "to", "the", "is", "are", or "will"
  rendered as plain English between translated words.
- When Chinese naturally omits a direct equivalent for an English helper word,
  either rewrite the English sentence so the helper word is not present, or map
  the larger phrase that expresses the same idea.
- zh is comma-separated hanzi, matching vocabulary entries at HSK <= N
- en must be a substring that literally appears in the english string
- The full Chinese sentence must be reconstructable from zh values + punctuation

### Step 3: Validate each sentence

For every `{ en, zh }` word mapping:

- `en` appears as a substring in `sentence.english` - error if not
- Each hanzi segment in `zh` exists in the `vocabulary` table - error if not
- Each hanzi segment is HSK <= story level - error if not
- Pinyin is available for each hanzi segment - error if not

For the sentence overall:

- At least 50% of meaningful content words (non-particles) have mappings - warn
  if not

### Step 4: Reconcile with existing `word_map`

For each `{ en, zh }` pair across all sentences:

- `word_map` already has `en` with the same `zh` - reuse it (most common case)
- `word_map` already has `en` with a DIFFERENT `zh` - flag conflict, skip
  insertion, print warning. The existing mapping wins to avoid breaking other
  stories.
- `word_map` does not have `en` - insert new row

At the end the script prints a summary:

```
18 word mappings reused from existing word_map
4 new word mappings inserted
1 conflict skipped: "go" (existing: "去", new: "走") - review manually
```

### Step 5: Insert story

All insertions happen in a single transaction:

- Insert `stories` row
- Insert `story_sentences` rows in order
- Insert `sentence_words` rows

Rollback everything on any validation error. On success print the new story ID.

### Example stories (seed data)

Two stories are included as seed data and inserted by
`scripts/seed-stories.ts`:

**HSK1 - "A Good Morning" (美好的早晨)**
~80 characters. Vocabulary: 今天, 天气, 好, 我, 家, 爸爸, 妈妈, 吃, 饭, 喝,
茶, 高兴, 去, 学校, 老师, 同学, 学习, 汉语

**HSK2 - "A Friend Visits" (朋友来了)**
~150 characters. Adds: 朋友, 来, 打电话, 告诉, 准备, 因为, 所以, 觉得, 已经,
一起, 知道, 想, 以后, 时间, 周末

The seed script uses the same validation pipeline as `create-story.ts` and
is idempotent (skips insert if title already exists).

---

## Implementation Phases

### Phase 1: Schema (Day 1)

1. Add `hanziLearned`, `hanziLearnedAt` to `user_word_state`
2. Add `stories`, `story_sentences`, `word_map`, `sentence_words` tables
3. Run `bun run db:push`

### Phase 2: Seed data (Day 1)

4. Write `scripts/seed-stories.ts` with HSK1 and HSK2 example stories
5. Run seed script, verify with `bun run db:studio`

### Phase 3: Listing page (Day 1-2)

6. `/stories/+page.server.ts` - load all stories with sentence count
7. `/stories/+page.svelte` - story cards grid with HSK filter

### Phase 4: Story reader - static (Day 2)

8. `/stories/[id]/+page.server.ts` - full data load (sentences, word maps,
   vocab lookups, user states)
9. `/stories/[id]/+page.svelte` - render sentences with correct per-word
   display mode
10. Controls bar: preview toggles, progress stats (X English / Y Pinyin / Z Hanzi)

### Phase 5: Interactivity (Day 3)

11. Single click: sentence translation hint card
12. Double-click / long press: `WordCard` component with all four action buttons
13. `POST /api/story-hanzi` endpoint (toggle hanziLearned)
14. `POST /api/story-word-learned` endpoint (toggle learned)
15. Optimistic state update across all matching spans in the story
16. Animated transition on span mode change (scale pop ~150ms)
17. Progress bar updates live on every toggle

### Phase 6: AI questions (Day 4)

16. Question mode toggle + multi-word selection state
17. `QuestionPanel` component (Markdown output)
18. `POST /api/story-question` endpoint

### Phase 7: AI pipeline (Day 4-5)

19. `scripts/create-story.ts` - full pipeline with all validation steps
20. Update `scripts/seed-stories.ts` to use the pipeline internals

### Phase 8: Integration and polish (Day 5)

21. Add Stories to desktop and mobile navigation
22. Hover tooltips on desktop (all three forms on hover)
23. Typography pass: line height, font sizing, spacing for mixed-mode text
24. Mobile touch handling (long-press detection)
25. Run `bun run check`, test both seed stories end to end

---

## Key Design Decisions

**Story content in JSON, not SQL:** Story text and word mappings should be
version-controlled JSON, not rows in `stories`, `story_sentences`, `word_map`,
and `sentence_words`. AI has struggled to create and repair this data reliably,
and JSON gives better diffs, review, manual edits, and rollback. SQL should only
hold user-specific progress/state.

**No duplicated Hanzi text:** The full Chinese text is reconstructable from the
JSON sentence `chinese` fields joined in order. Storing it separately would
create a sync risk.

**zh as comma-separated string, not array:** Keep `zh` compact and easy to
author, inspect, and compare in reviews. Comma-separated text can still be split
at runtime with no extra parsing layer.

**Sentence-level final flip:** Once all mapped words in a sentence are learned,
the whole sentence switches to `story_sentences.chinese`. This handles
English/Chinese word-order divergence (e.g. "What did I see?" = 我看见了什么)
which word-by-word reconstruction cannot. The abrupt order change is acceptable
because it only occurs when the user already knows every word.

**Word-selection for AI questions instead of native text selection:** Token spans
and mixed display modes break native browser text selection unpredictably,
especially on mobile. Click-to-toggle word selection is consistent across
devices and maps naturally to the word_map architecture.
