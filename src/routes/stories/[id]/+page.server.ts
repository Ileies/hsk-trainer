import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	stories,
	storySentences,
	wordMap,
	sentenceWords,
	vocabulary,
	userWordState
} from '$lib/server/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const userId = locals.user!.id;
	const storyId = parseInt(params.id);
	if (isNaN(storyId)) error(404, 'Story not found');

	const story = await db.select().from(stories).where(eq(stories.id, storyId)).get();
	if (!story) error(404, 'Story not found');

	// Load all sentences ordered by position
	const sentences = await db
		.select()
		.from(storySentences)
		.where(eq(storySentences.storyId, storyId))
		.orderBy(storySentences.position);

	if (sentences.length === 0) error(404, 'Story has no sentences');

	const sentenceIds = sentences.map((s) => s.id);

	// Load sentence -> word_map links
	const links = await db
		.select({ sentenceId: sentenceWords.sentenceId, wordMapId: sentenceWords.wordMapId })
		.from(sentenceWords)
		.where(inArray(sentenceWords.sentenceId, sentenceIds));

	// Collect unique word_map IDs
	const wordMapIds = [...new Set(links.map((l) => l.wordMapId))];

	// Load word_map rows
	const wordMapRows =
		wordMapIds.length > 0
			? await db.select().from(wordMap).where(inArray(wordMap.id, wordMapIds))
			: [];

	// Collect all unique hanzi segments across all word_map rows
	const allHanzi = [
		...new Set(
			wordMapRows.flatMap((w) =>
				w.zh
					.split(',')
					.map((h) => h.trim())
					.filter(Boolean)
			)
		)
	];

	// Load vocabulary for those hanzi (take lowest HSK level match per hanzi)
	const vocabRows =
		allHanzi.length > 0
			? await db
					.select({
						id: vocabulary.id,
						hanzi: vocabulary.hanzi,
						pinyin: vocabulary.pinyin,
						english: vocabulary.english,
						hskLevel: vocabulary.hskLevel
					})
					.from(vocabulary)
					.where(inArray(vocabulary.hanzi, allHanzi))
			: [];

	// If multiple vocab entries per hanzi, pick lowest HSK level
	const vocabByHanzi = new Map<string, (typeof vocabRows)[0]>();
	for (const v of vocabRows) {
		const existing = vocabByHanzi.get(v.hanzi);
		if (!existing || v.hskLevel < existing.hskLevel) vocabByHanzi.set(v.hanzi, v);
	}

	// Load user word states for those vocab IDs
	const vocabIds = [...new Set([...vocabByHanzi.values()].map((v) => v.id))];
	const stateRows =
		vocabIds.length > 0
			? await db
					.select({
						vocabId: userWordState.vocabId,
						learned: sql<number>`coalesce(${userWordState.learned}, 0)`,
						hanziLearned: sql<number>`coalesce(${userWordState.hanziLearned}, 0)`
					})
					.from(userWordState)
					.where(and(eq(userWordState.userId, userId), inArray(userWordState.vocabId, vocabIds)))
			: [];

	const stateByVocabId = new Map(stateRows.map((s) => [s.vocabId, s]));

	// Build per-sentence word map index: sentenceId -> wordMapId[]
	const sentenceWordMapIds = new Map<number, number[]>();
	for (const l of links) {
		const arr = sentenceWordMapIds.get(l.sentenceId) ?? [];
		arr.push(l.wordMapId);
		sentenceWordMapIds.set(l.sentenceId, arr);
	}

	// Serialize: attach word map entries to each sentence
	const sentencesWithWords = sentences.map((s) => ({
		...s,
		wordMapIds: sentenceWordMapIds.get(s.id) ?? []
	}));

	// Serialize vocab map: hanzi -> { id, pinyin, english, hskLevel }
	const vocabMap = Object.fromEntries(
		[...vocabByHanzi.entries()].map(([hanzi, v]) => [
			hanzi,
			{ id: v.id, pinyin: v.pinyin, english: v.english, hskLevel: v.hskLevel }
		])
	);

	// Serialize state map: vocabId -> { learned, hanziLearned }
	const stateMap = Object.fromEntries(
		[...stateByVocabId.entries()].map(([vocabId, s]) => [
			vocabId,
			{ learned: Boolean(s.learned), hanziLearned: Boolean(s.hanziLearned) }
		])
	);

	// Serialize word map: id -> { en, zh }
	const wordMapById = Object.fromEntries(wordMapRows.map((w) => [w.id, { en: w.en, zh: w.zh }]));

	return { story, sentences: sentencesWithWords, wordMapById, vocabMap, stateMap };
};
