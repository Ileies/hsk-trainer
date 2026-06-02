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

	const { wordId, hanzi, pinyinPlain, english, userAnswer } = await request.json();

	const openai = new OpenAI({ apiKey: key });

	const response = await openai.responses.create({
		model: 'gpt-5.4-nano',
		store: false,
		reasoning: { effort: 'none' },
		max_output_tokens: 32,
		input: `HSK pinyin typo check.

Word: ${hanzi} (${english})
Correct: ${pinyinPlain}
Typed: ${userAnswer || '(empty)'}

Step 1: Normalize both inputs by removing all spaces and tone numbers/marks.
Step 2: Compare syllable by syllable. If a syllable has at most one character error (extra, missing, or wrong key adjacent on keyboard), it is a typo for that syllable.
Step 3: Spaces and tone numbers are never counted as errors.

Reply "0" if ALL syllables match or are typos by the above definition. The overall shape of the word must still be recognizable.

If it's a genuine mistake (wrong syllable, completely wrong word, empty, or nonsensical input), reply with a very short reason under 8 words explaining why (e.g. "wrong first syllable" or "completely different word"). No prefix, just the reason.

When in doubt, mark as a mistake.`
	});

const text = (response.output_text ?? '').trim();
	const isTypo = text.startsWith('0');
	const reason = isTypo ? null : text || null;

	if (isTypo && wordId) {
		await db
			.update(vocabulary)
			.set({ learned: true, learnedAt: new Date() })
			.where(eq(vocabulary.id, wordId));
	}

	return json({ valid: isTypo ? 0 : 1, reason });
};
