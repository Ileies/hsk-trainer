import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary, userWordState } from '$lib/server/db/schema';
import { sql, eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;

	const stats = await db
		.select({
			hskLevel: vocabulary.hskLevel,
			total: sql<number>`count(*)`,
			learned: sql<number>`sum(case when coalesce(${userWordState.learned}, 0) = 1 then 1 else 0 end)`
		})
		.from(vocabulary)
		.leftJoin(
			userWordState,
			and(eq(userWordState.vocabId, vocabulary.id), eq(userWordState.userId, userId))
		)
		.groupBy(vocabulary.hskLevel)
		.orderBy(vocabulary.hskLevel);

	return { stats };
};

export const actions: Actions = {
	resetLevel: async ({ request, locals }) => {
		const userId = locals.user!.id;
		const data = await request.formData();
		const level = parseInt(data.get('level') as string);

		const vocabIds = await db
			.select({ id: vocabulary.id })
			.from(vocabulary)
			.where(eq(vocabulary.hskLevel, level));

		if (vocabIds.length > 0) {
			await db
				.delete(userWordState)
				.where(
					and(
						eq(userWordState.userId, userId),
						sql`${userWordState.vocabId} IN (${sql.join(vocabIds.map((v) => sql`${v.id}`), sql`, `)})`
					)
				);
		}
	}
};
