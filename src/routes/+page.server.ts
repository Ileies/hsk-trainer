import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import { sql, eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const stats = await db
		.select({
			hskLevel: vocabulary.hskLevel,
			total: sql<number>`count(*)`,
			learned: sql<number>`sum(case when ${vocabulary.learned} = 1 then 1 else 0 end)`
		})
		.from(vocabulary)
		.groupBy(vocabulary.hskLevel)
		.orderBy(vocabulary.hskLevel);

	return {
		stats
	};
};

export const actions: Actions = {
	resetLevel: async ({ request }) => {
		const data = await request.formData();
		const level = parseInt(data.get('level') as string);
		await db
			.update(vocabulary)
			.set({ learned: false, learnedAt: null })
			.where(eq(vocabulary.hskLevel, level));
	}
};
