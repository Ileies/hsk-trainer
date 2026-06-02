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
		input: `You are correcting the English translation on an HSK Chinese flashcard. The AI explanation below flagged a potential error.

Card:
- Hanzi: ${hanzi}
- Pinyin: ${pinyin}
- Current English: ${english}

Explanation that flagged issues: "${explanation}"

Formatting rules for the English translation:
- Keep it concise, like a dictionary entry (e.g. "to love", "big", "Beijing")
- For multiple meanings or alternatives, separate them with a comma and space (e.g. "to sit, to be seated"). Never use "or", angle brackets, slashes, or semicolons between alternatives.
- Use "to" before verbs (e.g. "to eat", "to go")
- Do not use parentheses for core meanings; parentheses are only for brief grammatical notes (e.g. "(negative prefix)")

Output ONLY a valid JSON object with a single key "english" containing the corrected English translation. No explanation, no markdown, no extra text.`
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
