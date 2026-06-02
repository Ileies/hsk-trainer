import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';

export async function load() {
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
}
