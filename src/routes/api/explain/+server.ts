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

Correct answer: "${pinyinPlain}" (tones: "${pinyin}", hanzi: "${hanzi}")
Student typed: "${userAnswer || '(nothing)'}"

First, verify the flashcard data independently of what the student typed: does "${english}" accurately describe the primary standalone meaning of "${hanzi}" (${pinyin})? Only flag an issue if the English is clearly wrong on its own - e.g. garbled/placeholder text, or a meaning that belongs to a completely different word. Do NOT flag it just because the student confused this word with another word - their confusion is not evidence of a flashcard error. Minor phrasing differences (e.g. "a time, a moment" vs "time; moment") are not errors. If and only if the English is genuinely wrong, begin your response with exactly: "Flashcard issue: the English should be '[correct meaning here]'." — then continue.

In 2-3 short sentences total, explain why the student's answer was wrong (if it reveals a likely confusion) and give a simple tip to remember the correct pinyin. Be encouraging and concise.`
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
