import { Database } from 'bun:sqlite';
import path from 'path';

const dbPath = path.resolve(import.meta.dir, '..', 'local.db');
const db = new Database(dbPath);

db.run('BEGIN');
try {
	// 1. Create junction table
	db.exec(`
		CREATE TABLE IF NOT EXISTS explains_users (
			explain_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			PRIMARY KEY (explain_id, user_id)
		)
	`);

	// 2. Deduplicate explains: for each (vocabulary_id, user_answer), keep the row
	//    with the lowest id and merge any user_id associations
	const dupes = db
		.prepare(
			`
		SELECT vocabulary_id, user_answer, MIN(id) AS keep_id, GROUP_CONCAT(id) AS all_ids
		FROM explains
		GROUP BY vocabulary_id, user_answer
		HAVING COUNT(*) > 1
	`
		)
		.all() as { vocabulary_id: number; user_answer: string; keep_id: number; all_ids: string }[];

	console.log(`Found ${dupes.length} duplicate (vocabulary_id, user_answer) groups`);

	for (const dupe of dupes) {
		const allIds = dupe.all_ids.split(',').map(Number);
		const dropIds = allIds.filter((id) => id !== dupe.keep_id);
		for (const dropId of dropIds) {
			console.log(`  Merging explain #${dropId} -> #${dupe.keep_id}`);
			db.prepare(`DELETE FROM explains WHERE id = ?`).run(dropId);
		}
	}

	// 3. Populate junction table from existing user_id column
	const inserted = db
		.prepare(
			`
		INSERT OR IGNORE INTO explains_users (explain_id, user_id)
		SELECT id, user_id FROM explains WHERE user_id IS NOT NULL
	`
		)
		.run();
	console.log(`Inserted ${inserted.changes} rows into explains_users`);

	// 4. Recreate explains without user_id, with UNIQUE(vocabulary_id, user_answer)
	db.exec(`
		CREATE TABLE explains_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			vocabulary_id INTEGER NOT NULL,
			hanzi TEXT NOT NULL,
			pinyin TEXT NOT NULL,
			english TEXT NOT NULL,
			user_answer TEXT NOT NULL,
			explanation TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			UNIQUE(vocabulary_id, user_answer)
		)
	`);

	const migrated = db
		.prepare(
			`
		INSERT INTO explains_new (id, vocabulary_id, hanzi, pinyin, english, user_answer, explanation, created_at)
		SELECT id, vocabulary_id, hanzi, pinyin, english, user_answer, explanation, created_at FROM explains
	`
		)
		.run();
	console.log(`Migrated ${migrated.changes} explains rows`);

	db.exec(`DROP TABLE explains`);
	db.exec(`ALTER TABLE explains_new RENAME TO explains`);
	db.exec(`CREATE INDEX IF NOT EXISTS explains_vocab_idx ON explains (vocabulary_id)`);

	console.log('Migration complete.');
})();

db.close();
