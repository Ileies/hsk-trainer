import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const words = await db
		.select({
			id: vocabulary.id,
			hanzi: vocabulary.hanzi,
			pinyin: vocabulary.pinyin,
			english: vocabulary.english,
			hskLevel: vocabulary.hskLevel
		})
		.from(vocabulary);

	return { words };
};
