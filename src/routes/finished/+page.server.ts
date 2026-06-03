import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary, userWordState } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url, locals }) => {
	const userId = locals.user!.id;
	const hskParam = url.searchParams.get('hsk');
	const hskLevel = hskParam ? parseInt(hskParam) : null;
	const showAll = url.searchParams.get('all') === '1';

	const conditions = [eq(userWordState.userId, userId)];
	if (!showAll) conditions.push(eq(userWordState.learned, true));
	if (hskLevel !== null && !isNaN(hskLevel)) {
		conditions.push(eq(vocabulary.hskLevel, hskLevel));
	}

	const words = await db
		.select({
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
		})
		.from(vocabulary)
		.innerJoin(userWordState, and(eq(userWordState.vocabId, vocabulary.id), ...conditions))
		.orderBy(vocabulary.hskLevel);

	return { words, hskLevel, showAll };
};

export const actions: Actions = {
	unlearn: async ({ request, locals }) => {
		const userId = locals.user!.id;
		const data = await request.formData();
		const wordId = parseInt(data.get('wordId') as string);
		if (!wordId || isNaN(wordId)) return;
		await db
			.update(userWordState)
			.set({ learned: false, learnedAt: null })
			.where(and(eq(userWordState.userId, userId), eq(userWordState.vocabId, wordId)));
	}
};
