import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary, userWordState } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;

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
		.innerJoin(
			userWordState,
			and(
				eq(userWordState.vocabId, vocabulary.id),
				eq(userWordState.userId, userId),
				eq(userWordState.starred, true)
			)
		)
		.orderBy(vocabulary.hskLevel);

	return { words };
};

export const actions: Actions = {
	unstar: async ({ request, locals }) => {
		const userId = locals.user!.id;
		const data = await request.formData();
		const wordId = parseInt(data.get('wordId') as string);
		if (!wordId || isNaN(wordId)) return;
		await db
			.update(userWordState)
			.set({ starred: false })
			.where(and(eq(userWordState.userId, userId), eq(userWordState.vocabId, wordId)));
	}
};
