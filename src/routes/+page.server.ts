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

	const topics = await db
		.selectDistinct({ topic: vocabulary.topic })
		.from(vocabulary)
		.where(sql`${vocabulary.topic} is not null`)
		.orderBy(vocabulary.topic);

	return {
		stats,
		topics: topics.map((t) => t.topic as string)
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
