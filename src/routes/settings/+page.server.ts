import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';

export const actions: Actions = {
	reset: async () => {
		await db.update(vocabulary).set({ learned: false, learnedAt: null });
	}
};
