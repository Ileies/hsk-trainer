import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isAuthPage =
		url.pathname === '/login' || url.pathname.startsWith('/auth/');

	if (isAuthPage || !locals.user) {
		return { words: [], user: locals.user };
	}

	const words = await db
		.select({
			id: vocabulary.id,
			hanzi: vocabulary.hanzi,
			pinyin: vocabulary.pinyin,
			english: vocabulary.english,
			hskLevel: vocabulary.hskLevel
		})
		.from(vocabulary);

	return { words, user: locals.user };
};
