import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('db:push rebuilds legacy tables without duplicate indexes or lost progress', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'hsk-db-push-'));
	const path = join(directory, 'local.db');
	try {
		const db = new Database(path);
		// Numeric boolean defaults force a rebuild; missing indexes must be created once.
		db.exec(`
			CREATE TABLE user_word_state (
				user_id integer NOT NULL,
				vocab_id integer NOT NULL,
				learned integer DEFAULT 0 NOT NULL,
				learned_at integer,
				starred integer DEFAULT 0 NOT NULL,
				mistake_count integer DEFAULT 0 NOT NULL,
				seen_at integer,
				hanzi_learned integer DEFAULT 0 NOT NULL,
				hanzi_learned_at integer,
				PRIMARY KEY (user_id, vocab_id)
			);
			INSERT INTO user_word_state VALUES (1, 42, 1, 100, 1, 3, 90, 1, 110);
		`);
		const progress = db.query('SELECT * FROM user_word_state').all();
		db.close();

		const push = async () => {
			const result = Bun.spawn(['bun', 'run', 'db:push', '--force'], {
				env: { ...process.env, DATA_DIR: directory },
				stdin: 'inherit',
				stdout: 'inherit',
				stderr: 'inherit'
			});
			expect(await result.exited).toBe(0);
		};

		await push();
		const migrated = new Database(path, { readonly: true });
		try {
			expect(migrated.query('SELECT * FROM user_word_state').all()).toEqual(progress);
			expect(
				migrated
					.query(
						"SELECT name FROM sqlite_schema WHERE type = 'index' AND name LIKE 'uws_%' ORDER BY name"
					)
					.all()
			).toEqual([{ name: 'uws_learned_idx' }, { name: 'uws_starred_idx' }]);
			expect(migrated.query('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
		} finally {
			migrated.close();
		}
		await push();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
