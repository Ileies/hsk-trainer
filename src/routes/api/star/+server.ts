import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userWordState } from '$lib/server/db/schema';

export async function POST({ request, locals }) {
	if (!locals.user) error(401, 'Unauthorized');
	const userId = locals.user.id;

	const { wordId, starred } = await request.json();
	if (!wordId || typeof starred !== 'boolean') error(400, 'Invalid payload');

	await db
		.insert(userWordState)
		.values({ userId, vocabId: wordId, starred })
		.onConflictDoUpdate({
			target: [userWordState.userId, userWordState.vocabId],
			set: { starred }
		});

	return json({ ok: true });
}
