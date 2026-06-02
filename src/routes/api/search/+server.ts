import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import { like, or, sql } from 'drizzle-orm';

export async function GET({ url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '8'), 50);

	if (!q) return json([]);

	const qLower = q.toLowerCase();
	const qNoSpaces = qLower.replace(/\s+/g, '');

	const results = await db
		.select()
		.from(vocabulary)
		.where(
			or(
				like(vocabulary.hanzi, `%${q}%`),
				like(vocabulary.english, `%${qLower}%`),
				like(vocabulary.pinyin, `%${qLower}%`),
				sql`replace(lower(${vocabulary.pinyinPlain}), ' ', '') like ${'%' + qNoSpaces + '%'}`
			)
		)
		.orderBy(vocabulary.hskLevel)
		.limit(limit);

	return json(results);
}
