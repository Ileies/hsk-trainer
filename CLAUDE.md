# HSK Trainer - Project Guide

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

All tables are defined in `src/lib/server/db/schema.ts`.

**`users`** - registered accounts
| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | auto-increment |
| `email` | text | unique |
| `created_at` | timestamp | |

**`auth_tokens`** - login tokens (magic link + PIN)
| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `user_id` | integer | FK to users |
| `token` | text | 64-char hex; used in magic link URL |
| `pin` | text nullable | 6-digit numeric PIN sent in same email |
| `expires_at` | timestamp | 15 minutes from issue |
| `used` | boolean | set to `true` on first use |

**`sessions`**
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | 64-char hex |
| `user_id` | integer | FK to users |
| `expires_at` | timestamp | 30 days from login |

**`vocabulary`** - the HSK word list
| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | auto-increment |
| `hanzi` | text | Chinese characters |
| `pinyin` | text | with tone diacritics (e.g. `nǐ hǎo`) |
| `pinyin_plain` | text | stripped tones, lowercase (e.g. `ni hao`) - this is what answers are checked against |
| `english` | text | definition; multiple meanings separated by `, ` |
| `hsk_level` | integer | 1-6 |
| `example_sentences` | text nullable | AI-generated sentences (pinyin + english pairs, `\n`-separated) |

**`user_word_state`** - per-user progress (one row per user+word pair)
| Column | Type | Notes |
|---|---|---|
| `user_id` | integer | composite PK with `vocab_id` |
| `vocab_id` | integer | FK into vocabulary |
| `learned` | boolean | |
| `learned_at` | timestamp nullable | |
| `starred` | boolean | user bookmark |
| `mistake_count` | integer | incremented on wrong answers |
| `seen_at` | timestamp nullable | first time the card was shown; null means the word is new |

**`explains`** - saved AI explanations for wrong answers (shared across users, de-duped by vocab+answer)
| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `vocabulary_id` | integer | |
| `hanzi/pinyin/english` | text | snapshot at time of explanation |
| `user_answer` | text | what the user typed |
| `explanation` | text | AI-generated Markdown |
| `created_at` | timestamp | |

**`explains_users`** - junction table: which users have seen which explain
| Column | Type | Notes |
|---|---|---|
| `explain_id` | integer | composite PK with `user_id` |
| `user_id` | integer | |

**`explains_cache`** - one cached explanation per vocabulary word
| Column | Type | Notes |
|---|---|---|
| `vocab_id` | integer PK | |
| `explanation` | text | |
| `created_at` | timestamp | |

## Authentication

The app is fully protected: `src/hooks.server.ts` checks the `session` cookie on every request and redirects to `/login` if the session is missing or expired.

**Login flow:**
1. User enters their email on `/login`
2. Server creates an `auth_tokens` row (token + 6-digit PIN, 15-minute expiry) and sends an email via Nodemailer
3. User either clicks the magic link (`/auth/verify?token=...`) or enters the PIN on the next screen
4. A 30-day session is created and stored in `sessions`; the `session` cookie is set

New users are automatically created on first login - there is no separate registration step.

`locals.user` is `{ id, email }` or `null` on every server load/action. The layout server passes `user` to the client as `data.user`.

**Admin-only endpoints:** `ADMIN_MAIL` env var - if set, only that email may call `POST /api/repair`.

## Route map

| Route | Purpose |
|---|---|
| `/login` | Passwordless login: enter email, then magic link or PIN |
| `/auth/verify` | Magic link callback - validates token, creates session |
| `/auth/logout` | Destroys session cookie and redirects to `/login` |
| `/` | Dashboard: per-level progress cards |
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
| `POST /api/repair` | AI flashcard repair (admin only) - updates `vocabulary.english` in DB, returns `{english}` |
| `POST /api/star` | Toggle star - body `{wordId, starred}` |
| `GET /api/practice-next` | Next word for client-side session navigation |

## Practice page - key mechanics

**URL params act as session state:**
- `?hsk=N` - filter to HSK level N
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

**`learned` flag is set in two places** (in `user_word_state` for the current user):
- Server action `?/answer` on a correct string match
- `/api/check-answer` when the AI declares a typo

**`mistake_count`** is incremented in `user_word_state` on every wrong answer (including AI-confirmed wrong answers).

## Root layout - important gotcha

`src/routes/+layout.server.ts` loads **the entire vocabulary** (id, hanzi, pinyin, english, hskLevel only) on every page load and passes it as `data.words`. It also passes `data.user` (the current user object). This feeds the `MapCanvas` component, which is always mounted in the layout (hidden via CSS when not on `/map`) to preserve simulation state across navigation. Avoid querying the full vocabulary elsewhere if you can reuse this data.

On auth pages (`/login`, `/auth/*`) the layout skips the vocabulary query and returns `{ words: [], user: locals.user }`.

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

## Scripts

**`scripts/generate-sentences.ts`** - AI-generates example sentences for vocabulary words that have none. Uses OpenAI with concurrency 20, writes results back to `vocabulary.example_sentences`. Run with `bun scripts/generate-sentences.ts [--limit N]`.

**`scripts/deploy.ts`** - compresses `build/` + `.env`, uploads via SCP to `ros:/var/www/hsk-trainer`, extracts (preserving `local.db`), restarts via PM2. Run via `bun run deploy`.

**Migration scripts** (one-time, keep for reference):
- `scripts/migrate-multiuser.ts` - added users/sessions/userWordState tables
- `scripts/migrate-explains-junction.ts` - replaced `explains.user_id` column with `explains_users` junction table

## Common tasks

**Add a new column to `vocabulary`:**
1. Edit `src/lib/server/db/schema.ts`
2. Run `bun run db:push`
3. Update `serializePracticeWord` in `src/lib/server/practice.ts` if it needs to reach the client

**Add a new per-user state column:**
Add it to `user_word_state` in `schema.ts`, then `bun run db:push`. The `wordWithStateSelect` helper in `practice.ts` uses `coalesce(column, default)` so left-joining users without a row still works.

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

**Deploy to production:**
```bash
bun run build && bun run deploy
```
Compresses `build/` + `.env`, uploads via SCP to `ros:/var/www/hsk-trainer`, extracts (preserving `local.db`), and restarts via PM2. Configured in `scripts/deploy.ts`.

**Required env vars for production:** `DATABASE_URL`, `SMTP_HOST`, and at least `SMTP_FROM`. Optional: `OPENAI_KEY`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `ADMIN_MAIL`.

**Inspect the database:**
```bash
bun run db:studio
```

## Conventions to follow

- Svelte 5 Runes everywhere: `$state`, `$derived`, `$effect`, `$props` - no `writable()`, no `$:`, no `export let`
- Server-only code lives under `src/lib/server/` - never import from there in `.svelte` files directly (only via load functions or API routes)
- English translations use `, ` to separate meanings (not `;` or `/`)
- Pinyin with tones = `pinyin` column; without tones lowercase = `pinyinPlain` column - keep both in sync
- All protected routes rely on `locals.user` being populated by `hooks.server.ts`; never bypass this check manually
- Per-user progress always reads from / writes to `user_word_state`, never directly on `vocabulary`
