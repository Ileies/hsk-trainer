# HSK Tester - Project Guide

## What this is

A self-hosted SvelteKit flashcard app for learning Chinese vocabulary from the official HSK word lists (levels 1-6, ~5,000 words). The core loop: show an English meaning, the user types pinyin without tone marks, the app checks the answer. OpenAI integrates as an optional layer for typo tolerance, wrong-answer explanations, and flashcard repair.

## Tech stack

- **Runtime / package manager:** Bun
- **Framework:** SvelteKit 2 with **Svelte 5 Runes** enforced project-wide (`runes: true` in `svelte.config.js`) - never use legacy stores or Svelte 4 patterns
- **Styling:** Tailwind CSS v4 + DaisyUI v5
- **Database:** SQLite via Drizzle ORM + `better-sqlite3`; database file is `local.db`
- **AI:** OpenAI SDK (`openai` package), using `openai.responses.create` (not `chat.completions`)
- **Adapter:** `@sveltejs/adapter-node` - builds to `build/` as a standalone server
- **Imports:** always use `$lib/` aliases, never relative paths from `src/`

## Database schema

Two tables, defined in `src/lib/server/db/schema.ts`:

**`vocabulary`** - the HSK word list
| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | auto-increment |
| `hanzi` | text | Chinese characters |
| `pinyin` | text | with tone diacritics (e.g. `nǐ hǎo`) |
| `pinyin_plain` | text | stripped tones, lowercase (e.g. `ni hao`) - this is what answers are checked against |
| `english` | text | definition; multiple meanings separated by `, ` |
| `hsk_level` | integer | 1-6 |
| `topic` | text nullable | auto-detected category (e.g. `food & drink`, `transport`) |
| `learned` | boolean | set to `true` when answered correctly or when AI confirms a typo |
| `learned_at` | timestamp nullable | when it was marked learned |
| `starred` | boolean | user bookmark |
| `example_sentences` | text nullable | two pinyin sentences separated by `\n` |

**`explains`** - saved AI explanations for wrong answers
| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `vocabulary_id` | integer | FK into vocabulary (not a hard constraint) |
| `hanzi/pinyin/english` | text | snapshot of the word at time of explanation |
| `user_answer` | text | what the user typed |
| `explanation` | text | AI-generated Markdown |
| `created_at` | timestamp | |

## Route map

| Route | Purpose |
|---|---|
| `/` | Dashboard: per-level progress cards + topic badges |
| `/practice` | Flashcard loop (main feature - see below) |
| `/finished` | Grid of learned words; allows un-learning |
| `/search` | Full-text search (hanzi / pinyin / english); word detail view |
| `/starred` | Starred words |
| `/map` | Force-directed word graph (canvas) |
| `/explains` | History of saved AI explanations |
| `/settings` | Progress reset (danger zone) |
| `GET /api/search` | Typeahead search used by navbar and word map (`?q=&limit=`) |
| `POST /api/check-answer` | AI typo check - returns `{valid: 0|1, reason}` |
| `POST /api/explain` | AI explanation - saves to DB, returns `{explanation}` |
| `POST /api/repair` | AI flashcard repair - updates `vocabulary.english` in DB, returns `{english}` |
| `POST /api/star` | Toggle star - body `{wordId, starred}` |
| `GET /api/practice-next` | Next word for client-side session navigation |

## Practice page - key mechanics

**URL params act as session state:**
- `?hsk=N` - filter to HSK level N
- `?topic=X` - filter to topic X
- `?exclude=1,2,3` - comma-separated IDs already seen this session (excluded from random pick)
- `?last=N` - ID of the last shown word (also soft-excluded to avoid repeats)

**Answer normalization** (`/practice/+page.server.ts`):
- `v` is treated as `u` (common pinyin shorthand)
- whitespace collapsed; answer also checked without any spaces
- comparison is against `pinyinPlain` (no tones, lowercase)

**AI check flow** (client-side in `+page.svelte`):
1. Form action `?/answer` runs server-side string comparison
2. If wrong AND `aiCheck` is enabled (localStorage toggle), POST to `/api/check-answer`
3. If `valid === 0` (typo), mark as correct + mark learned in DB; show "You could have also typed: ..."
4. If `valid === 1`, show as wrong with optional `reason` text

**`learned` flag is set in two places:**
- Server action `?/answer` on a correct string match
- `/api/check-answer` when the AI declares a typo

## Root layout - important gotcha

`src/routes/+layout.server.ts` loads **the entire vocabulary** (id, hanzi, pinyin, english, hskLevel only) on every page load and passes it as `data.words`. This feeds the `MapCanvas` component, which is always mounted in the layout (hidden via CSS when not on `/map`) to preserve simulation state across navigation. Avoid querying the full vocabulary elsewhere if you can reuse this data.

## Word map

`src/lib/MapCanvas.svelte` - Canvas-based, no DOM nodes per word:
- Force simulation runs once client-side (300 ticks, then frozen)
- Edges connect words that share CJK characters; max 15 edges per node
- BFS from focused node used for depth-based opacity/size rendering
- Camera: pan (drag), zoom (wheel), animated lerp each frame
- Hit-testing via d3-quadtree

`src/lib/mapGraph.ts` - pure graph logic: `buildGraph(words)` returns edges + adjacency map; `bfsDistances(adjacency, startId, maxDepth)` returns a `Map<id, depth>`.

## AI integration

All three API routes use `openai.responses.create` (not `chat.completions`), with `store: false`.

| Route | Model | Notes |
|---|---|---|
| `/api/check-answer` | `gpt-5.4-nano` | Ultra-fast; `max_output_tokens: 32`; replies `"0"` for typos, short reason otherwise |
| `/api/explain` | `gpt-5.4-mini` | 2-3 sentence explanation in Markdown; stored to `explains` table |
| `/api/repair` | `gpt-5.4-mini` | Returns `{english: "..."}` JSON; updates `vocabulary.english` in DB |

All three return 500 if `OPENAI_KEY` is unset. The UI handles this gracefully (buttons just fail silently or show an error state).

## Seed script

`scripts/seed.ts` reads `static/hsk{1-6}.csv` (format: `hanzi,pinyin,english`), strips tones to produce `pinyinPlain`, auto-detects a topic via regex rules, and upserts into the database (skips existing `hanzi:hskLevel` pairs). Run with `bun run db:seed`.

## Common tasks

**Add a new column to vocabulary:**
1. Edit `src/lib/server/db/schema.ts`
2. Run `bun run db:push`
3. Update `serializePracticeWord` in `src/lib/server/practice.ts` if it needs to reach the client

**Add a new API endpoint:**
Create `src/routes/api/<name>/+server.ts`, export named handlers (`GET`, `POST`, etc.)

**Add a new page:**
Create `src/routes/<name>/+page.svelte` and optionally `+page.server.ts` for the load function or form actions

**Run type-check:**
```bash
bun run check
```

**Run the dev server:**
```bash
bun run dev
```

**Inspect the database:**
```bash
bun run db:studio
```

## Conventions to follow

- Svelte 5 Runes everywhere: `$state`, `$derived`, `$effect`, `$props` - no `writable()`, no `$:`, no `export let`
- Server-only code lives under `src/lib/server/` - never import from there in `.svelte` files directly (only via load functions or API routes)
- English translations use `, ` to separate meanings (not `;` or `/`)
- Pinyin with tones = `pinyin` column; without tones lowercase = `pinyinPlain` column - keep both in sync
