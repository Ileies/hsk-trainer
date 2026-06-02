import { and, eq, notInArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';

export type PracticeWord = {
	id: number;
	hanzi: string;
	pinyin: string;
	pinyinPlain: string;
	english: string;
	hskLevel: number;
	exampleSentences: string | null;
	starred: boolean;
};

export function parseNullableInt(value: string | null) {
	if (!value) return null;
	const parsed = parseInt(value);
	return Number.isNaN(parsed) ? null : parsed;
}

export function parsePositiveIds(value: string | null) {
	return value
		? value
				.split(',')
				.map(Number)
				.filter((n) => !Number.isNaN(n) && n > 0)
		: [];
}

export function serializePracticeWord(word: typeof vocabulary.$inferSelect): PracticeWord {
	return {
		id: word.id,
		hanzi: word.hanzi,
		pinyin: word.pinyin,
		pinyinPlain: word.pinyinPlain,
		english: word.english,
		hskLevel: word.hskLevel,
		exampleSentences: word.exampleSentences,
		starred: word.starred
	};
}

function buildConditions(hsk: number | null) {
	const conds = [eq(vocabulary.learned, false)];
	if (hsk) conds.push(eq(vocabulary.hskLevel, hsk));
	return conds.length === 1 ? conds[0] : and(...conds);
}

export async function getPracticeData(
	hsk: number | null,
	excludeIds: number[],
	lastId: number | null
) {
	const baseWhere = buildConditions(hsk);

	const softExcludeIds = [...excludeIds, ...(lastId ? [lastId] : [])];
	let word: typeof vocabulary.$inferSelect | undefined;

	if (softExcludeIds.length > 0) {
		[word] = await db
			.select()
			.from(vocabulary)
			.where(and(baseWhere, notInArray(vocabulary.id, softExcludeIds)))
			.orderBy(sql`RANDOM()`)
			.limit(1);
	}

	if (!word && lastId && excludeIds.length === 0) {
		[word] = await db
			.select()
			.from(vocabulary)
			.where(baseWhere)
			.orderBy(sql`RANDOM()`)
			.limit(1);
	} else if (!word && lastId && excludeIds.length > 0) {
		[word] = await db
			.select()
			.from(vocabulary)
			.where(and(baseWhere, notInArray(vocabulary.id, excludeIds)))
			.orderBy(sql`RANDOM()`)
			.limit(1);
	}

	if (!word && softExcludeIds.length === 0) {
		[word] = await db
			.select()
			.from(vocabulary)
			.where(baseWhere)
			.orderBy(sql`RANDOM()`)
			.limit(1);
	}

	const [{ remaining }] = await db
		.select({ remaining: sql<number>`count(*)` })
		.from(vocabulary)
		.where(baseWhere);

	const [{ total }] = await db
		.select({ total: sql<number>`count(*)` })
		.from(vocabulary)
		.where(hsk ? eq(vocabulary.hskLevel, hsk) : undefined);

	const needsReset = !word && remaining > 0 && excludeIds.length > 0;

	return {
		word: word ? serializePracticeWord(word) : null,
		remaining,
		total,
		learned: total - remaining,
		needsReset
	};
}

