# HSK Trainer

A self-hosted flashcard web app for learning Chinese vocabulary from the official HSK (Hanyu Shuiping Kaoshi) word lists. Covers all six HSK levels (~5,000 words) with AI-assisted grading, interactive word maps, and per-level progress tracking.

## Features

**Multi-user / authentication**
- Passwordless login via email magic link or 6-digit PIN
- Each user has their own progress, starred words, and explanations
- Sessions last 30 days; all protected pages redirect to `/login` when unauthenticated

**Practice**
- Flashcard loop: English prompt, you type the pinyin (without tone marks)
- AI typo check distinguishes genuine mistakes from slips (wrong key, transposed letter, etc.)
- Filter practice sessions by HSK level (1-6)
- Session progress bar and remaining-word counter
- Skip a card without marking it as learned
- Star any word for later review

**AI assistance** (requires OpenAI key)
- Smart answer grading: borderline answers are sent to GPT for a second opinion
- Explain button: 2-3 sentence explanation of why your answer was wrong, with a memory tip
- Repair flashcard: ask the AI to correct an English translation (admin-only)
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
| Email | [Nodemailer](https://nodemailer.com) (magic link + PIN delivery) |
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
| `SMTP_HOST` | Yes | SMTP server hostname for sending login emails |
| `SMTP_PORT` | No | SMTP port (default: `587`) |
| `SMTP_SECURE` | No | Set to `true` for TLS (port 465); default `false` |
| `SMTP_USER` | No | SMTP auth username (omit for unauthenticated relay) |
| `SMTP_PASS` | No | SMTP auth password |
| `SMTP_FROM` | No | From address (defaults to `noreply@<hostname>`) |
| `ADMIN_MAIL` | No | Email address that may use the flashcard repair endpoint |

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
| `bun run db:seed` | Seed vocabulary from `scripts/seed.ts` |
| `bun run db:studio` | Open Drizzle Studio (visual DB browser) |
| `bun run deploy` | Deploy to the production server via SSH |

## Project Structure

```
src/
  hooks.server.ts           # Session validation; redirects unauthenticated requests to /login
  lib/
    MapCanvas.svelte        # Canvas-based force-directed word graph
    mapGraph.ts             # Graph construction and BFS for the word map
    app.svelte.ts           # Module-level $state for cross-navigation session data
    server/
      auth.ts               # Token / PIN / session generation helpers
      email.ts              # Nodemailer - sends magic link + PIN emails
      db/
        index.ts            # Drizzle client
        schema.ts           # All DB tables (see Database schema below)
      practice.ts           # Practice query logic (word selection, progress counts)
  routes/
    +page                   # Dashboard
    login/                  # Passwordless login (email -> magic link or PIN)
    auth/
      verify/               # Magic link callback - creates session
      logout/               # Destroys session cookie
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
      repair/               # AI flashcard repair (admin only)
      practice-next/        # Next word for the practice session
      search/               # Search endpoint (used by the word map)
      star/                 # Toggle star on a word
scripts/
  generate-sentences.ts     # AI-generates example sentences and writes them to the DB
  deploy.ts                 # SCP deploy to production
```

## Production Deployment

Build and deploy to the remote server in one step:

```bash
bun run build
bun run deploy
```

`deploy` compresses the `build/` output and `.env` into an archive, uploads it via `scp` to `ros:/var/www/hsk-trainer`, extracts it there (preserving `local.db`), and restarts the app with PM2.

The SQLite file is the only persistent state; back it up to preserve study progress.

## License

Private — not licensed for redistribution.
