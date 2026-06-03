import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary, userWordState } from '$lib/server/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import {
	getPracticeData,
	parseNullableInt,
	parsePositiveIds,
	serializePracticeWord
} from '$lib/server/practice';

export const load: PageServerLoad = async ({ url, locals }) => {
	const userId = locals.user!.id;
	const hsk = parseNullableInt(url.searchParams.get('hsk'));
	const excludeIds = parsePositiveIds(url.searchParams.get('exclude'));
	const lastId = parseNullableInt(url.searchParams.get('last'));
	const practiceData = await getPracticeData(userId, hsk, excludeIds, lastId);

	return { ...practiceData, hsk };
};

export const actions: Actions = {
	answer: async ({ request, locals }) => {
		const userId = locals.user!.id;
		const formData = await request.formData();
		const wordId = parseInt(formData.get('wordId') as string);
		const userAnswer = ((formData.get('answer') as string) ?? '').trim().toLowerCase();

		if (!wordId || isNaN(wordId)) return fail(400, { error: 'Invalid word ID' });

		const [word] = await db.select().from(vocabulary).where(eq(vocabulary.id, wordId));
		if (!word) return fail(404, { error: 'Word not found' });

		const normalize = (s: string) => s.replace(/v/g, 'u').replace(/\s+/g, ' ').trim();
		const strip = (s: string) => s.replace(/\s/g, '');

		const normalized = normalize(userAnswer);
		const correct =
			normalized === word.pinyinPlain || strip(normalized) === strip(word.pinyinPlain);

		if (correct) {
			await db
				.insert(userWordState)
				.values({ userId, vocabId: wordId, learned: true, learnedAt: new Date() })
				.onConflictDoUpdate({
					target: [userWordState.userId, userWordState.vocabId],
					set: { learned: true, learnedAt: new Date() }
				});
		} else {
			await db
				.insert(userWordState)
				.values({ userId, vocabId: wordId, mistakeCount: 1 })
				.onConflictDoUpdate({
					target: [userWordState.userId, userWordState.vocabId],
					set: { mistakeCount: sql`${userWordState.mistakeCount} + 1` }
				});
		}

		const [state] = await db
			.select()
			.from(userWordState)
			.where(and(eq(userWordState.userId, userId), eq(userWordState.vocabId, wordId)));

		const wordWithState = {
			...word,
			learned: state?.learned ? 1 : 0,
			learnedAt: state?.learnedAt ?? null,
			starred: state?.starred ? 1 : 0,
			mistakeCount: state?.mistakeCount ?? (correct ? 0 : 1),
			seenAt: state?.seenAt ?? null
		};

		return {
			correct,
			userAnswer,
			word: serializePracticeWord(wordWithState)
		};
	}
};
