import { and, eq, notInArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { vocabulary, userWordState } from '$lib/server/db/schema';

export type PracticeWord = {
	id: number;
	hanzi: string;
	pinyin: string;
	pinyinPlain: string;
	english: string;
	hskLevel: number;
	mistakeCount: number;
	isNew: boolean;
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

type RawWordRow = {
	id: number;
	hanzi: string;
	pinyin: string;
	pinyinPlain: string;
	english: string;
	hskLevel: number;
	exampleSentences: string | null;
	learned: number;
	learnedAt: Date | null;
	starred: number;
	mistakeCount: number;
	seenAt: Date | null;
};

export function serializePracticeWord(word: RawWordRow): PracticeWord {
	return {
		id: word.id,
		hanzi: word.hanzi,
		pinyin: word.pinyin,
		pinyinPlain: word.pinyinPlain,
		english: word.english,
		hskLevel: word.hskLevel,
		mistakeCount: word.mistakeCount,
		isNew: word.seenAt === null,
		exampleSentences: word.exampleSentences,
		starred: !!word.starred
	};
}

function wordWithStateSelect(userId: number) {
	return {
		id: vocabulary.id,
		hanzi: vocabulary.hanzi,
		pinyin: vocabulary.pinyin,
		pinyinPlain: vocabulary.pinyinPlain,
		english: vocabulary.english,
		hskLevel: vocabulary.hskLevel,
		exampleSentences: vocabulary.exampleSentences,
		learned: sql<number>`coalesce(${userWordState.learned}, 0)`,
		learnedAt: userWordState.learnedAt,
		starred: sql<number>`coalesce(${userWordState.starred}, 0)`,
		mistakeCount: sql<number>`coalesce(${userWordState.mistakeCount}, 0)`,
		seenAt: userWordState.seenAt,
		_userId: sql<number>`${userId}`
	};
}

function userStateJoin(userId: number) {
	return and(eq(userWordState.vocabId, vocabulary.id), eq(userWordState.userId, userId));
}

function buildConditions(userId: number, hsk: number | null) {
	const conds = [sql`coalesce(${userWordState.learned}, 0) = 0`];
	if (hsk) conds.push(eq(vocabulary.hskLevel, hsk));
	return and(...conds);
}

export async function getPracticeData(
	userId: number,
	hsk: number | null,
	excludeIds: number[],
	lastId: number | null
) {
	const baseWhere = buildConditions(userId, hsk);
	const select = wordWithStateSelect(userId);
	const join = userStateJoin(userId);

	const softExcludeIds = [...excludeIds, ...(lastId ? [lastId] : [])];
	let word: RawWordRow | undefined;

	if (softExcludeIds.length > 0) {
		[word] = await db
			.select(select)
			.from(vocabulary)
			.leftJoin(userWordState, join)
			.where(and(baseWhere, notInArray(vocabulary.id, softExcludeIds)))
			.orderBy(sql`RANDOM()`)
			.limit(1);
	}

	if (!word && lastId && excludeIds.length === 0) {
		[word] = await db
			.select(select)
			.from(vocabulary)
			.leftJoin(userWordState, join)
			.where(baseWhere)
			.orderBy(sql`RANDOM()`)
			.limit(1);
	} else if (!word && lastId && excludeIds.length > 0) {
		[word] = await db
			.select(select)
			.from(vocabulary)
			.leftJoin(userWordState, join)
			.where(and(baseWhere, notInArray(vocabulary.id, excludeIds)))
			.orderBy(sql`RANDOM()`)
			.limit(1);
	}

	if (!word && softExcludeIds.length === 0) {
		[word] = await db
			.select(select)
			.from(vocabulary)
			.leftJoin(userWordState, join)
			.where(baseWhere)
			.orderBy(sql`RANDOM()`)
			.limit(1);
	}

	const [{ remaining }] = await db
		.select({ remaining: sql<number>`count(*)` })
		.from(vocabulary)
		.leftJoin(userWordState, join)
		.where(baseWhere);

	const [{ total }] = await db
		.select({ total: sql<number>`count(*)` })
		.from(vocabulary)
		.where(hsk ? eq(vocabulary.hskLevel, hsk) : undefined);

	if (word && word.seenAt === null) {
		await db
			.insert(userWordState)
			.values({ userId, vocabId: word.id, seenAt: new Date() })
			.onConflictDoUpdate({
				target: [userWordState.userId, userWordState.vocabId],
				set: { seenAt: new Date() }
			});
	}

	const needsReset = !word && remaining > 0 && excludeIds.length > 0;

	return {
		word: word ? serializePracticeWord(word) : null,
		remaining,
		total,
		learned: total - remaining,
		needsReset
	};
}
