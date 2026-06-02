import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const key = env.OPENAI_KEY;
	if (!key) throw error(500, 'OPENAI_KEY is not configured');

	const { wordId, hanzi, pinyin, pinyinPlain, english, explanation } = await request.json();

	const openai = new OpenAI({ apiKey: key });

	const response = await openai.responses.create({
		model: 'gpt-5.4-mini',
		store: false,
		input: `You are writing the English translation for an HSK Chinese flashcard.

Card:
- Hanzi: ${hanzi}
- Pinyin: ${pinyin}

Write a concise dictionary-style translation for this specific word as it appears on its own (not in compounds).

Formatting rules:
- Include only the 1-3 most important standalone meanings. Drop rare, compound-only, or redundant senses.
- Separate meanings with a comma and space (e.g. "to sit, to be seated"). Never use "or", angle brackets, slashes, semicolons, or curly braces.
- Use "to" before verbs (e.g. "to eat", "to go")
- Do not use parentheses for core meanings; parentheses are only for brief grammatical notes (e.g. "(negative prefix)")

Output ONLY a valid JSON object with a single key "english".`
	});

	let corrected: { english: string };
	try {
		corrected = JSON.parse(response.output_text ?? '');
	} catch {
		throw error(500, 'AI returned invalid JSON');
	}

	if (typeof corrected.english !== 'string') {
		throw error(500, 'AI returned incomplete data');
	}

	await db
		.update(vocabulary)
		.set({ english: corrected.english })
		.where(eq(vocabulary.id, wordId));

	return json(corrected);
};
