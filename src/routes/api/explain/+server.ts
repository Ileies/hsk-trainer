import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { explains } from '$lib/server/db/schema';

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

type ErrorType = 'close_typo' | 'transposition' | 'wrong_syllable_count' | 'partial' | 'different';

function classifyError(correct: string, typed: string): ErrorType {
	const correctSyls = correct.trim().split(/\s+/);
	const typedSyls = typed.trim().split(/\s+/);

	if (correctSyls.length !== typedSyls.length) return 'wrong_syllable_count';
	if ([...correctSyls].sort().join('|') === [...typedSyls].sort().join('|')) return 'transposition';

	const dist = levenshtein(correct.replace(/\s/g, ''), typed.replace(/\s/g, ''));
	const ratio = dist / Math.max(correct.replace(/\s/g, '').length, typed.replace(/\s/g, '').length);
	if (ratio <= 0.25) return 'close_typo';
	if (ratio <= 0.6) return 'partial';
	return 'different';
}

function buildBlankPrompt(
	hanzi: string,
	pinyin: string,
	pinyinPlain: string,
	english: string,
	hskLevel: number | null
): string {
	const level = hskLevel ?? 3;
	const charCount = hanzi.length;
	const chars = [...hanzi].join(', ');

	let focus: string;
	let exampleStyle: string;

	if (level <= 2) {
		focus =
			charCount === 1
				? `Give a vivid visual or story mnemonic to make "${english}" stick. Mention the character's shape or radical if it helps.`
				: `Break down what each character (${chars}) means and how they combine to form "${english}". Keep it simple.`;
		exampleStyle = 'very short and beginner-friendly';
	} else if (level <= 4) {
		focus =
			charCount === 1
				? `Explain the meaning with useful associations, etymology, or how it's used in compounds.`
				: `Break down each character (${chars}) and how they combine. Add one practical usage tip - collocations, common contexts, or what it contrasts with.`;
		exampleStyle = 'natural, everyday';
	} else {
		focus =
			charCount === 1
				? `Explain the nuance, register, and usage context. When is this used vs similar words?`
				: `Explain what each character (${chars}) contributes, the register (formal/written/spoken), and when to use this over similar expressions.`;
		exampleStyle = 'natural, showing proper context and register';
	}

	return `Chinese HSK ${level} word: "${english}" = ${pinyinPlain} (${pinyin}, ${hanzi}).

${focus} No pinyin tips. Use only pinyin (no hanzi) in your explanation sentences. Max 3 sentences.

Then two ${exampleStyle} example sentences using ${hanzi}, each on its own line: *pinyin with tones* - English translation.`;
}

function buildWrongPrompt(
	hanzi: string,
	pinyin: string,
	pinyinPlain: string,
	english: string,
	hskLevel: number | null,
	userAnswer: string
): string {
	const level = hskLevel ?? 3;
	const errorType = classifyError(pinyinPlain, userAnswer);

	if (errorType === 'different') {
		return `HSK ${level} flashcard. Prompt: "${english}". Correct: "${pinyinPlain}" (${pinyin}, ${hanzi}). Student typed: "${userAnswer}".

The student typed a completely different word. In 3-4 sentences: (1) identify what "${userAnswer}" means and why it doesn't fit this prompt, (2) explain what makes "${pinyinPlain}" the right word, (3) if they are near-synonyms, clearly highlight the distinction. Use only pinyin (no hanzi). Be encouraging.

Then one example sentence for "${pinyinPlain}" and one for "${userAnswer}" to contrast usage, each on its own line: *pinyin with tones* - English translation.`;
	}

	const errorHint: Record<Exclude<ErrorType, 'different'>, string> = {
		close_typo: 'The student was very close - only a small spelling difference.',
		transposition: 'The student had the right syllables but in the wrong order.',
		wrong_syllable_count: `The student typed ${userAnswer.trim().split(/\s+/).length} syllable(s); the correct answer has ${pinyinPlain.trim().split(/\s+/).length}.`,
		partial: 'The student partially remembered the pinyin.'
	};

	return `HSK ${level} flashcard. Prompt: "${english}". Correct: "${pinyinPlain}" (${pinyin}, ${hanzi}). Student typed: "${userAnswer}". ${errorHint[errorType]}

In 2-3 sentences: explain the mistake and how to remember the correct answer. Focus on meaning and associations, not pinyin pronunciation. Use only pinyin (no hanzi) in your explanation sentences. Be encouraging.

Then two example sentences using ${hanzi}, each on its own line: *pinyin with tones* - English translation.`;
}

export const POST: RequestHandler = async ({ request }) => {
	const key = env.OPENAI_KEY;
	if (!key) throw error(500, 'OPENAI_KEY is not configured');

	const { wordId, hanzi, pinyin, pinyinPlain, english, hskLevel, userAnswer } =
		await request.json();

	const openai = new OpenAI({ apiKey: key });

	const prompt = userAnswer
		? buildWrongPrompt(hanzi, pinyin, pinyinPlain, english, hskLevel, userAnswer)
		: buildBlankPrompt(hanzi, pinyin, pinyinPlain, english, hskLevel);

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
