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

	const response = await openai.responses.create({
		model: 'gpt-5.4-mini',
		store: false,
		input: `A student is learning Chinese vocabulary using HSK flashcards. They were asked to type the pinyin (no tone marks) for the English prompt "${english}".

Correct answer: "${pinyinPlain}" (tones: "${pinyin}", hanzi: "${hanzi}", HSK level: ${hskLevel ?? 'unknown'})
Student typed: "${userAnswer || '(nothing)'}"

In 2-3 short sentences, help the student understand their mistake and remember the correct pinyin. Focus on what tripped them up (common confusion, syllable split, similar-sounding word, etc.) and give a memorable tip. Be encouraging and concise.`
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
