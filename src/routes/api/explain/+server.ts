import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { explains } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request }) => {
	const key = env.OPENAI_KEY;
	if (!key) throw error(500, 'OPENAI_KEY is not configured');

	const { wordId, hanzi, pinyin, pinyinPlain, english, hskLevel, userAnswer } = await request.json();

	const openai = new OpenAI({ apiKey: key });

	const prompt = userAnswer
		? `A student is learning Chinese vocabulary using HSK flashcards. They were asked to type the pinyin (no tone marks) for the English prompt "${english}".

Correct answer: "${pinyinPlain}" (tones: "${pinyin}", hanzi: "${hanzi}", HSK level: ${hskLevel ?? 'unknown'})
Typed: "${userAnswer}"

In 2-3 short sentences, help understand the mistake and remember the correct pinyin. Focus on what went wrong (common confusion, syllable split, similar-sounding word, etc.) and give a memorable tip. Be encouraging and concise. Then add two example sentences using this word, each on its own line, in the format: *pinyin with tones* - English translation.`
		: `Explain this HSK ${hskLevel ?? ''} Chinese word to help remember it: "${english}" = ${pinyinPlain} (${pinyin}, ${hanzi}).

In 2-3 short sentences, give a memorable explanation - cover the meaning, any useful associations, and tips for remembering the pinyin. Be encouraging and concise. Then add two example sentences using this word, each on its own line, in the format: *pinyin with tones* - English translation.`;

	const response = await openai.responses.create({
		model: 'gpt-5.4-mini',
		store: false,
		input: prompt
	});

	const explanation = response.output_text;

	if (wordId) {
		await db.insert(explains).values({
			vocabularyId: wordId,
			hanzi,
			pinyin,
			english,
			userAnswer: userAnswer || '',
			explanation,
			createdAt: new Date()
		});
	}

	return json({ explanation });
};
