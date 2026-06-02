import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function POST({ request }) {
	const { wordId, starred } = await request.json();
	if (!wordId || typeof starred !== 'boolean') throw error(400, 'Invalid payload');

	await db.update(vocabulary).set({ starred }).where(eq(vocabulary.id, wordId));

	return json({ ok: true });
}
