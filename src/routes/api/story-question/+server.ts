import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { stories, wordMap, vocabulary } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const key = env.OPENAI_KEY;
	if (!key) error(500, 'OPENAI_KEY is not configured');

	const body = await request.json();
	const storyId: number = body.storyId;
	const selectedWordMapIds: number[] = body.selectedWordMapIds ?? [];
	const selectedText: string = body.selectedText ?? '';
	const question: string = body.question ?? '';

	if (!question.trim()) error(400, 'Missing question');
	if (selectedWordMapIds.length === 0 && !selectedText.trim()) error(400, 'No text selected');

	const story = await db.select().from(stories).where(eq(stories.id, storyId)).get();
	if (!story) error(404, 'Story not found');

	const wordMapRows =
		selectedWordMapIds.length > 0
			? await db.select().from(wordMap).where(inArray(wordMap.id, selectedWordMapIds))
			: [];

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

	const vocabRows =
		allHanzi.length > 0
			? await db
					.select({
						hanzi: vocabulary.hanzi,
						pinyin: vocabulary.pinyin,
						english: vocabulary.english,
						hskLevel: vocabulary.hskLevel
					})
					.from(vocabulary)
					.where(inArray(vocabulary.hanzi, allHanzi))
			: [];

	const vocabByHanzi = new Map(vocabRows.map((v) => [v.hanzi, v]));

	const wordDetails = wordMapRows
		.map((w) => {
			const segs = w.zh
				.split(',')
				.map((h) => h.trim())
				.filter(Boolean);
			const hanzi = segs.join('');
			const pinyin = segs.map((h) => vocabByHanzi.get(h)?.pinyin ?? h).join(' ');
			const english = segs
				.map((h) => vocabByHanzi.get(h)?.english?.split(',')[0] ?? '')
				.filter(Boolean)
				.join(', ');
			return `"${w.en}" -> ${hanzi} (${pinyin}) = ${english}`;
		})
		.join('\n');

	const selectionContext = selectedText.trim()
		? `Selected phrase: "${selectedText}"\n\n${wordDetails ? `Vocabulary in selection:\n${wordDetails}` : ''}`
		: `Selected words:\n${wordDetails}`;

	const prompt = `You are helping a student studying Mandarin Chinese at HSK level ${story.hskLevel}.

Story: "${story.titleEnglish}" (${story.title})

${selectionContext}

Student question: ${question}

Answer in 2-4 sentences. Assume the student knows HSK 1-${story.hskLevel} vocabulary. Focus on the "why" - usage, grammar, nuance - not just dictionary definitions. Use pinyin with tone marks when referencing Chinese words.`;

	const openai = new OpenAI({ apiKey: key });
	const response = await openai.responses.create({
		model: 'gpt-4.1-mini',
		store: false,
		input: prompt
	});

	return json({ answer: response.output_text });
};
