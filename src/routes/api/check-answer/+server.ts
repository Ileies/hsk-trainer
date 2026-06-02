import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { vocabulary } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

function levenshtein(a: string, b: string): number {
	const m = a.length, n = b.length;
	const dp = Array.from({ length: m + 1 }, (_, i) =>
		Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
	);
	for (let i = 1; i <= m; i++)
		for (let j = 1; j <= n; j++)
			dp[i][j] =
				a[i - 1] === b[j - 1]
					? dp[i - 1][j - 1]
					: 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
	return dp[m][n];
}

export const POST: RequestHandler = async ({ request }) => {
	const key = env.OPENAI_KEY;
	if (!key) throw error(500, 'OPENAI_KEY is not configured');

	const { wordId, hanzi, pinyinPlain, english, userAnswer } = await request.json();

	const correct = (pinyinPlain as string).replace(/\s/g, '').toLowerCase();
	const typed = ((userAnswer as string) ?? '').replace(/\s/g, '').toLowerCase();

	if (!typed) return json({ valid: 1, reason: null });

	const dist = levenshtein(correct, typed);
	const maxLen = Math.max(correct.length, typed.length);
	const ratio = dist / maxLen;

	async function accept() {
		if (wordId)
			await db
				.update(vocabulary)
				.set({ learned: true, learnedAt: new Date() })
				.where(eq(vocabulary.id, wordId));
		return json({ valid: 0, reason: null });
	}

	// Obvious typo: small edit distance relative to word length - no AI needed
	if (dist === 1 && maxLen >= 5) return accept();
	if (dist <= 2 && maxLen >= 8) return accept();

	// Clearly too far off - skip the AI call
	if (ratio > 0.5) return json({ valid: 1, reason: null });

	// Borderline: let the AI decide
	const openai = new OpenAI({ apiKey: key });

	const response = await openai.responses.create({
		model: 'gpt-5.4-nano',
		store: false,
		reasoning: { effort: 'none' },
		max_output_tokens: 32,
		input: `Pinyin typo check.

Word: ${hanzi} (${english})
Correct: ${correct}
Typed: ${typed}

Is this a typo (student clearly knows the word) or a genuine pinyin mistake?
Reply "0" for a typo. Otherwise a short reason under 8 words. No prefix. When in doubt, reply "0".`
	});

	const text = (response.output_text ?? '').trim();
	const isTypo = text.startsWith('0');

	if (isTypo) return accept();
	return json({ valid: 1, reason: text || null });
};
