import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary, userWordState } from '$lib/server/db/schema';
import { like, or, sql, eq, and } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

const wordSelect = (userId: number) => ({
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
	seenAt: userWordState.seenAt
});

export const load: PageServerLoad = async ({ url, locals }) => {
	const userId = locals.user!.id;
	const q = url.searchParams.get('q')?.trim() ?? '';
	const idParam = url.searchParams.get('id');
	const id = idParam ? parseInt(idParam) : NaN;

	if (!isNaN(id)) {
		const [word] = await db
			.select(wordSelect(userId))
			.from(vocabulary)
			.leftJoin(
				userWordState,
				and(eq(userWordState.vocabId, vocabulary.id), eq(userWordState.userId, userId))
			)
			.where(eq(vocabulary.id, id));
		if (!word) error(404, 'Word not found');
		return { mode: 'detail' as const, word, q };
	}

	if (!q) return { mode: 'search' as const, results: [], q };

	const qLower = q.toLowerCase();
	const qNoSpaces = qLower.replace(/\s+/g, '');

	const results = await db
		.select(wordSelect(userId))
		.from(vocabulary)
		.leftJoin(
			userWordState,
			and(eq(userWordState.vocabId, vocabulary.id), eq(userWordState.userId, userId))
		)
		.where(
			or(
				like(vocabulary.hanzi, `%${q}%`),
				like(vocabulary.english, `%${qLower}%`),
				like(vocabulary.pinyin, `%${qLower}%`),
				sql`replace(lower(${vocabulary.pinyinPlain}), ' ', '') like ${'%' + qNoSpaces + '%'}`
			)
		)
		.orderBy(vocabulary.hskLevel);

	return { mode: 'search' as const, results, q };
};

export const actions: Actions = {
	star: async ({ request, locals }) => {
		const userId = locals.user!.id;
		const data = await request.formData();
		const wordId = parseInt(data.get('wordId') as string);
		const starred = data.get('starred') === 'true';
		if (!wordId || isNaN(wordId)) return;
		await db
			.insert(userWordState)
			.values({ userId, vocabId: wordId, starred })
			.onConflictDoUpdate({
				target: [userWordState.userId, userWordState.vocabId],
				set: { starred }
			});
	}
};
