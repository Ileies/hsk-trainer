/**
 * One-time migration: single-user -> multi-user.
 * Run BEFORE db:push. Creates new auth/state tables, migrates existing
 * learned/starred/mistakeCount/seenAt data to user_word_state, and
 * rebuilds the explains table with a user_id column.
 *
 * Usage:
 *   SEED_EMAIL=you@example.com bun scripts/migrate-multiuser.ts
 */

import { Database } from 'bun:sqlite';

const db = new Database('local.db');

const tables = (
	db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
).map((t) => t.name);

if (tables.includes('users')) {
	console.log('Migration already applied (users table exists). Skipping.');
	process.exit(0);
}

const seedEmail = process.env.SEED_EMAIL || 'admin@localhost';

const migrate = db.transaction(() => {
	// --- New auth tables ---

	db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )`);

	db.run(`CREATE TABLE auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  )`);
	db.run(`CREATE UNIQUE INDEX auth_tokens_token_idx ON auth_tokens(token)`);

	db.run(`CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`);
	db.run(`CREATE INDEX sessions_user_idx ON sessions(user_id)`);

	db.run(`CREATE TABLE user_word_state (
    user_id INTEGER NOT NULL,
    vocab_id INTEGER NOT NULL,
    learned INTEGER NOT NULL DEFAULT 0,
    learned_at INTEGER,
    starred INTEGER NOT NULL DEFAULT 0,
    mistake_count INTEGER NOT NULL DEFAULT 0,
    seen_at INTEGER,
    PRIMARY KEY (user_id, vocab_id)
  )`);
	db.run(`CREATE INDEX uws_learned_idx ON user_word_state(user_id, learned)`);
	db.run(`CREATE INDEX uws_starred_idx ON user_word_state(user_id, starred)`);

	db.run(`CREATE TABLE explains_cache (
    vocab_id INTEGER PRIMARY KEY,
    explanation TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);

	// --- Seed user ---
	db.run(`INSERT INTO users (email, created_at) VALUES (?, ?)`, [
		seedEmail,
		Math.floor(Date.now() / 1000)
	]);
	const { id: userId } = db.query('SELECT last_insert_rowid() as id').get() as { id: number };
	console.log(`Created seed user "${seedEmail}" with id ${userId}`);

	// --- Migrate vocabulary state ---
	const vocabCols = (db.query('PRAGMA table_info(vocabulary)').all() as { name: string }[]).map(
		(c) => c.name
	);

	if (vocabCols.includes('learned')) {
		const migrated = db.run(
			`INSERT INTO user_word_state (user_id, vocab_id, learned, learned_at, starred, mistake_count, seen_at)
       SELECT ?, id, learned, learned_at, starred, mistake_count, seen_at
       FROM vocabulary
       WHERE learned = 1 OR starred = 1 OR mistake_count > 0 OR seen_at IS NOT NULL`,
			[userId]
		);
		console.log(`Migrated ${migrated.changes} vocabulary rows -> user_word_state`);
	} else {
		console.log('vocabulary table has no legacy user-state columns, nothing to migrate');
	}

	// --- Rebuild explains with user_id ---
	const explainsCols = (db.query('PRAGMA table_info(explains)').all() as { name: string }[]).map(
		(c) => c.name
	);

	if (!explainsCols.includes('user_id')) {
		db.run(`CREATE TABLE explains_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vocabulary_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      hanzi TEXT NOT NULL,
      pinyin TEXT NOT NULL,
      english TEXT NOT NULL,
      user_answer TEXT NOT NULL,
      explanation TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`);
		db.run(
			`INSERT INTO explains_new
       SELECT id, vocabulary_id, ?, hanzi, pinyin, english, user_answer, explanation, created_at
       FROM explains`,
			[userId]
		);
		db.run(`DROP TABLE explains`);
		db.run(`ALTER TABLE explains_new RENAME TO explains`);
		db.run(`CREATE INDEX explains_vocab_idx ON explains(vocabulary_id)`);
		db.run(`CREATE INDEX explains_user_idx ON explains(user_id)`);
		const count = (db.query('SELECT count(*) as n FROM explains').get() as { n: number }).n;
		console.log(`Rebuilt explains with user_id (${count} rows)`);
	}
});

migrate();
console.log('Migration complete. Now run: bun run db:push');
