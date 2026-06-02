# HSK Trainer

A self-hosted flashcard web app for learning Chinese vocabulary from the official HSK (Hanyu Shuiping Kaoshi) word lists. Covers all six HSK levels (~5,000 words) with AI-assisted grading, interactive word maps, and per-level progress tracking.

## Features

**Practice**
- Flashcard loop: English prompt, you type the pinyin (without tone marks)
- AI typo check distinguishes genuine mistakes from slips (wrong key, transposed letter, etc.)
- Filter practice sessions by HSK level (1-6) or topic category
- Session progress bar and remaining-word counter
- Skip a card without marking it as learned
- Star any word for later review

**AI assistance** (requires OpenAI key)
- Smart answer grading: borderline answers are sent to GPT for a second opinion
- Explain button: 2-3 sentence explanation of why your answer was wrong, with a memory tip
- Repair flashcard: ask the AI to correct an English translation it judges to be wrong
- All explanations are saved and accessible from the Explanations page

**Word Map**
- Force-directed graph of the entire vocabulary, with nodes connected by shared Chinese characters
- Zoom, pan, click to focus on a word and highlight its character neighbors
- Filter by HSK level; search to locate any word on the map

**Other**
- Dashboard with per-level progress bars and overall percentage
- Full-text search across Chinese characters, pinyin, and English
- Detailed word view with example sentences
- Review and un-learn individual words from the Finished page
- Settings page with a progress reset option

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [SvelteKit](https://kit.svelte.dev) + Svelte 5 Runes |
| Runtime | [Bun](https://bun.sh) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) + [DaisyUI v5](https://daisyui.com) |
| Database | SQLite via [Drizzle ORM](https://orm.drizzle.team) + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| AI | [OpenAI SDK](https://github.com/openai/openai-node) (gpt-5.4-nano for grading, gpt-5.4-mini for explanations) |
| Visualisation | [d3-force](https://d3js.org/d3-force) + [d3-quadtree](https://d3js.org/d3-quadtree), rendered on Canvas |
| Adapter | `@sveltejs/adapter-node` (standalone Node/Bun server) |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- An OpenAI API key (only required for AI features; the app works without one)

### Setup

```bash
# Install dependencies
bun install

# Create your environment file
cp .env.example .env
# Edit .env and set OPENAI_KEY=<your-key>

# Create the database schema and seed the vocabulary
bun run db:push
bun run db:seed

# Start the dev server
bun run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Path to the SQLite file (default: `local.db`) |
| `OPENAI_KEY` | No | OpenAI API key. AI features are disabled when unset. |

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the Vite dev server |
| `bun run build` | Build for production |
| `bun run preview` | Preview the production build locally |
| `bun run check` | Type-check with `svelte-check` |
| `bun run lint` | Run Prettier and ESLint |
| `bun run format` | Auto-format all files |
| `bun run test` | Run unit tests with Vitest |
| `bun run db:push` | Push schema changes to the database |
| `bun run db:seed` | Import HSK CSV files into the database |
| `bun run db:studio` | Open Drizzle Studio (visual DB browser) |

## Project Structure

```
src/
  lib/
    MapCanvas.svelte        # Canvas-based force-directed word graph
    mapGraph.ts             # Graph construction and BFS for the word map
    server/
      db/
        index.ts            # Drizzle client
        schema.ts           # vocabulary + explains tables
      practice.ts           # Practice query logic (word selection, progress counts)
  routes/
    +page                   # Dashboard
    practice/               # Flashcard practice
    finished/               # Review learned words
    search/                 # Vocabulary search
    starred/                # Starred words
    map/                    # Interactive word map
    explains/               # Saved AI explanations
    settings/               # Progress reset
    api/
      check-answer/         # AI typo vs. genuine mistake grading
      explain/              # AI explanation for a wrong answer
      repair/               # AI flashcard repair
      practice-next/        # Next word for the practice session
      search/               # Search endpoint (used by the word map)
      star/                 # Toggle star on a word
scripts/
  seed.ts                   # Parses HSK CSVs and inserts vocabulary
static/
  hsk1.csv - hsk6.csv       # Official HSK word lists (hanzi, pinyin, English)
```

## Production Deployment

Build and run the standalone server:

```bash
bun run build
node build/index.js
# or:
bun build/index.js
```

Set the `DATABASE_URL` and `OPENAI_KEY` environment variables in production. The SQLite file is the only persistent state; back it up to preserve study progress.

## License

Private — not licensed for redistribution.
