import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const hskParam = url.searchParams.get('hsk');
	const hskLevel = hskParam ? parseInt(hskParam) : null;
	const showAll = url.searchParams.get('all') === '1';

	const conditions = [];
	if (!showAll) conditions.push(eq(vocabulary.learned, true));
	if (hskLevel !== null && !isNaN(hskLevel)) {
		conditions.push(eq(vocabulary.hskLevel, hskLevel));
	}

	const words = await db
		.select()
		.from(vocabulary)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(vocabulary.hskLevel);

	return { words, hskLevel, showAll };
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
