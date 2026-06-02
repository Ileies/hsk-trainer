import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const words = await db
		.select()
		.from(vocabulary)
		.where(eq(vocabulary.starred, true))
		.orderBy(vocabulary.hskLevel);

	return { words };
};

export const actions: Actions = {
	unstar: async ({ request }) => {
		const data = await request.formData();
		const wordId = parseInt(data.get('wordId') as string);
		if (!wordId || isNaN(wordId)) return;
		await db.update(vocabulary).set({ starred: false }).where(eq(vocabulary.id, wordId));
	}
};
