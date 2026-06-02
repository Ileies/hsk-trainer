import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { explains } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request }) => {
	const key = env.OPENAI_KEY;
	if (!key) throw error(500, 'OPENAI_KEY is not configured');

	const { wordId, hanzi, pinyin, pinyinPlain, english, userAnswer } = await request.json();

	const openai = new OpenAI({ apiKey: key });

	const response = await openai.responses.create({
		model: 'gpt-5.4-mini',
		store: false,
		input: `A student is learning Chinese vocabulary using HSK flashcards. They were asked to translate the English word "${english}" into pinyin (without tone marks).

Correct answer: "${pinyinPlain}" (with tones: "${pinyin}", Chinese: "${hanzi}")
Student typed: "${userAnswer || '(nothing)'}"

The app's vocabulary data was AI-generated, so be critical of it too: if the English prompt, Chinese word, or pinyin seems wrong or ambiguous, say so briefly instead of assuming the student is wrong.

In 2-3 short sentences, explain: why the student's answer was wrong (if it reveals a likely confusion), and give a simple tip to remember the correct pinyin for this word. Be encouraging and concise.`
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
