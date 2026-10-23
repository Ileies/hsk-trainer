import type { Actions } from './$types';
import { db } from '#lib/server/db/index.js';
import { userWordState } from '#lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export const actions: Actions = {
	reset: async ({ locals }) => {
		const userId = locals.user!.id;
		await db.delete(userWordState).where(eq(userWordState.userId, userId));
	}
};
