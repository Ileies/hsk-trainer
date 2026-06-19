import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { explains, explainsCache, explainsUsers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

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

function isPinyinHeavy(text: string): boolean {
	const lines = text.split('\n');
	const explanationLines: string[] = [];
	for (const line of lines) {
		if (/^\s*\*/.test(line)) break;
		explanationLines.push(line);
	}
	const explanation = explanationLines.join(' ');
	const toneMarkRe = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
	const words = explanation.split(/\s+/).filter((w) => w.length > 1);
	if (words.length < 5) return false;
	const pinyinCount = words.filter((w) => toneMarkRe.test(w)).length;
	return pinyinCount / words.length > 0.2;
}

function buildBlankPrompt(
	hanzi: string,
	pinyin: string,
	pinyinPlain: string,
	english: string,
	hskLevel: number | null
): string {
	const level = hskLevel ?? 3;

	let focus: string;
	let exampleStyle: string;

	if (level <= 2) {
		focus = `Give a memorable tip to connect the sound "${pinyinPlain}" to the meaning "${english}". A sound-alike in English, a rhyme, or a vivid image triggered by hearing it works well. Do not explain Chinese characters or their shapes.`;
		exampleStyle = 'very short and beginner-friendly';
	} else if (level <= 4) {
		focus = `Help the learner connect the sound "${pinyinPlain}" to the meaning "${english}". You can describe when this word is heard in daily speech, give an English sound-alike, or contrast it with a word that sounds similar.`;
		exampleStyle = 'natural, everyday';
	} else {
		focus = `Explain the nuance and spoken register of "${pinyinPlain}" = "${english}". When would a native speaker say this vs similar words? Is it formal, casual, or written-only? Focus on spoken usage.`;
		exampleStyle = 'natural, showing proper spoken context and register';
	}

	return `You are helping a learner who is studying spoken Mandarin Chinese. The goal is to recognize and pronounce words by ear - this is NOT about reading or writing Chinese characters.

HSK ${level} word: "${english}" is spoken as "${pinyinPlain}" (with tones: ${pinyin}).

${focus}

Write your explanation in English. You may reference the pronunciation "${pinyinPlain}" inline, but do not analyze or explain the Chinese characters. Max 3 sentences.

Then two ${exampleStyle} example sentences, each on its own line: *pinyin with tones* - English translation.`;
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
		return `You are helping a learner who is studying spoken Mandarin Chinese - NOT reading or writing characters.

HSK ${level} flashcard. Prompt: "${english}". Correct pronunciation: "${pinyinPlain}" (tones: ${pinyin}). The learner typed: "${userAnswer}".

The learner typed a completely different word. Write in English: (1) explain what "${userAnswer}" means in Chinese and why it doesn't match "${english}", (2) explain what makes "${pinyinPlain}" the right word to say, (3) if they are near-synonyms, highlight the distinction in meaning or spoken usage. Do not analyze Chinese characters. Be encouraging.

Then one example sentence for "${pinyinPlain}" and one for "${userAnswer}" to contrast usage, each on its own line: *pinyin with tones* - English translation.`;
	}

	const errorHint: Record<Exclude<ErrorType, 'different'>, string> = {
		close_typo: 'The learner was very close - only a small spelling difference.',
		transposition: 'The learner had the right syllables but in the wrong order.',
		wrong_syllable_count: `The learner typed ${userAnswer.trim().split(/\s+/).length} syllable(s); the correct answer has ${pinyinPlain.trim().split(/\s+/).length}.`,
		partial: 'The learner partially remembered the pinyin.'
	};

	return `You are helping a learner who is studying spoken Mandarin Chinese - NOT reading or writing characters.

HSK ${level} flashcard. Prompt: "${english}". Correct: "${pinyinPlain}" (tones: ${pinyin}). Learner typed: "${userAnswer}". ${errorHint[errorType]}

Write in English: in 2-3 sentences, explain the mistake and give a tip to remember the correct sound. Focus on the meaning and spoken use of the word. Be encouraging.

Then two example sentences for "${pinyinPlain}", each on its own line: *pinyin with tones* - English translation.`;
}

async function generate(openai: OpenAI, prompt: string): Promise<string> {
	const call = (p: string) =>
		openai.responses.create({ model: 'gpt-5.4-mini', store: false, service_tier: 'flex', input: p });

	let text = (await call(prompt)).output_text;
	if (isPinyinHeavy(text)) {
		const retryPrompt = prompt + '\n\nRespond in English.';
		text = (await call(retryPrompt)).output_text;
	}
	return text;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const userId = locals.user.id;

	const key = env.OPENAI_KEY;
	if (!key) error(500, 'OPENAI_KEY is not configured');

	const { wordId, hanzi, pinyin, pinyinPlain, english, hskLevel, userAnswer } =
		await request.json();

	const isBlank = !userAnswer;
	let explanation: string;

	if (isBlank && wordId) {
		const [cached] = await db
			.select()
			.from(explainsCache)
			.where(eq(explainsCache.vocabId, wordId))
			.limit(1);

		if (cached) {
			explanation = cached.explanation;
		} else {
			const openai = new OpenAI({ apiKey: key });
			explanation = await generate(openai, buildBlankPrompt(hanzi, pinyin, pinyinPlain, english, hskLevel));
			await db
				.insert(explainsCache)
				.values({ vocabId: wordId, explanation })
				.onConflictDoNothing();
		}
	} else {
		if (wordId && userAnswer) {
			const [cached] = await db
				.select({ explanation: explains.explanation })
				.from(explains)
				.where(and(eq(explains.vocabularyId, wordId), eq(explains.userAnswer, userAnswer)))
				.limit(1);
			if (cached) {
				explanation = cached.explanation;
			} else {
				const openai = new OpenAI({ apiKey: key });
				explanation = await generate(openai, buildWrongPrompt(hanzi, pinyin, pinyinPlain, english, hskLevel, userAnswer));
			}
		} else {
			const openai = new OpenAI({ apiKey: key });
			explanation = await generate(openai, buildBlankPrompt(hanzi, pinyin, pinyinPlain, english, hskLevel));
		}
	}

	if (wordId) {
		const normalizedAnswer = userAnswer || '';
		const row = await db
			.insert(explains)
			.values({ vocabularyId: wordId, hanzi, pinyin, english, userAnswer: normalizedAnswer, explanation, createdAt: new Date() })
			.onConflictDoNothing()
			.returning({ id: explains.id });

		const explainId = row[0]?.id ?? (
			await db
				.select({ id: explains.id })
				.from(explains)
				.where(and(eq(explains.vocabularyId, wordId), eq(explains.userAnswer, normalizedAnswer)))
				.limit(1)
		)[0].id;

		await db
			.insert(explainsUsers)
			.values({ explainId, userId })
			.onConflictDoNothing();
	}

	return json({ explanation });
};
