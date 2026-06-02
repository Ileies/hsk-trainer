import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { vocabulary } from '../src/lib/server/db/schema';
import data from './vocabulary-data.json';

async function main() {
	const db = drizzle(new Database('local.db'));

	const existing = await db
		.select({ hanzi: vocabulary.hanzi, hskLevel: vocabulary.hskLevel })
		.from(vocabulary);
	const existingSet = new Set(existing.map((e) => `${e.hanzi}:${e.hskLevel}`));

	const newEntries = data
		.filter((e) => !existingSet.has(`${e.hanzi}:${e.hsk_level}`))
		.map((e) => ({
			hanzi: e.hanzi,
			pinyin: e.pinyin,
			pinyinPlain: e.pinyin_plain,
			english: e.english,
			hskLevel: e.hsk_level,
			exampleSentences: e.example_sentences,
			learned: false
		}));

	const BATCH = 500;
	for (let i = 0; i < newEntries.length; i += BATCH) {
		await db.insert(vocabulary).values(newEntries.slice(i, i + BATCH));
	}

	const perLevel: Record<number, number> = {};
	for (const e of data) perLevel[e.hsk_level] = (perLevel[e.hsk_level] ?? 0) + 1;
	for (const [level, count] of Object.entries(perLevel).sort()) {
		console.log(`HSK ${level}: ${count} words`);
	}
	console.log(`\nInserted ${newEntries.length} new entries (${data.length - newEntries.length} already existed)`);
}

main().catch(console.error);
