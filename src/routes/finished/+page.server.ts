import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const hskParam = url.searchParams.get('hsk');
	const hskLevel = hskParam ? parseInt(hskParam) : null;

	const conditions = [eq(vocabulary.learned, true)];
	if (hskLevel !== null && !isNaN(hskLevel)) {
		conditions.push(eq(vocabulary.hskLevel, hskLevel));
	}

	const words = await db
		.select()
		.from(vocabulary)
		.where(and(...conditions))
		.orderBy(vocabulary.hskLevel);

	return { words, hskLevel };
};

export const actions: Actions = {
	unlearn: async ({ request }) => {
		const data = await request.formData();
		const wordId = parseInt(data.get('wordId') as string);
		if (!wordId || isNaN(wordId)) return;
		await db
			.update(vocabulary)
			.set({ learned: false, learnedAt: null })
			.where(eq(vocabulary.id, wordId));
	}
};
