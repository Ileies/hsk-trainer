import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { userWordState } from '$lib/server/db/schema';
import { json, error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user?.id;
	if (!userId) error(401, 'Unauthorized');

	const body = await request.json();
	const vocabIds: number[] = body.vocabIds ?? [];
	const learned: boolean = Boolean(body.learned);

	if (!Array.isArray(vocabIds) || vocabIds.length === 0) error(400, 'Missing vocabIds');

	const now = new Date();

	for (const vocabId of vocabIds) {
		await db
			.insert(userWordState)
			.values({
				userId,
				vocabId,
				learned,
				learnedAt: learned ? now : null,
				hanziLearned: false,
				hanziLearnedAt: null,
				starred: false,
				mistakeCount: 0
			})
			.onConflictDoUpdate({
				target: [userWordState.userId, userWordState.vocabId],
				set: {
					learned,
					learnedAt: learned ? now : null,
					...(learned ? {} : { hanziLearned: false, hanziLearnedAt: null })
				}
			});
	}

	return json({ ok: true });
};
