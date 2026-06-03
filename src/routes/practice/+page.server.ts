import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import {
	getPracticeData,
	parseNullableInt,
	parsePositiveIds,
	serializePracticeWord
} from '$lib/server/practice';

export const load: PageServerLoad = async ({ url }) => {
	const hsk = parseNullableInt(url.searchParams.get('hsk'));
	const excludeIds = parsePositiveIds(url.searchParams.get('exclude'));
	const lastId = parseNullableInt(url.searchParams.get('last'));
	const practiceData = await getPracticeData(hsk, excludeIds, lastId);

	return {
		...practiceData,
		hsk
	};
};

export const actions: Actions = {
	answer: async ({ request }) => {
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
				.update(vocabulary)
				.set({ learned: true, learnedAt: new Date() })
				.where(eq(vocabulary.id, wordId));
		} else {
			await db
				.update(vocabulary)
				.set({ mistakeCount: sql`${vocabulary.mistakeCount} + 1` })
				.where(eq(vocabulary.id, wordId));
		}

		return {
			correct,
			userAnswer,
			word: serializePracticeWord(word)
		};
	}
};
