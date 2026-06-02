import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import { like, or, sql, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const idParam = url.searchParams.get('id');
	const id = idParam ? parseInt(idParam) : NaN;

	if (!isNaN(id)) {
		const [word] = await db.select().from(vocabulary).where(eq(vocabulary.id, id));
		if (!word) throw error(404, 'Word not found');
		return { mode: 'detail' as const, word, q };
	}

	if (!q) return { mode: 'search' as const, results: [], q };

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
		.orderBy(vocabulary.hskLevel);

	return { mode: 'search' as const, results, q };
};

export const actions: Actions = {
	star: async ({ request }) => {
		const data = await request.formData();
		const wordId = parseInt(data.get('wordId') as string);
		const starred = data.get('starred') === 'true';
		if (!wordId || isNaN(wordId)) return;
		await db.update(vocabulary).set({ starred }).where(eq(vocabulary.id, wordId));
	}
};
