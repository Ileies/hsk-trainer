import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stories, storySentences } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({
			id: stories.id,
			title: stories.title,
			titleEnglish: stories.titleEnglish,
			hskLevel: stories.hskLevel,
			description: stories.description,
			sentenceCount: sql<number>`count(${storySentences.id})`
		})
		.from(stories)
		.leftJoin(storySentences, eq(storySentences.storyId, stories.id))
		.groupBy(stories.id)
		.orderBy(stories.hskLevel);

	return { stories: rows };
};
