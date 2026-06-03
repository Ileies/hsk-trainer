import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { vocabulary } from '../src/lib/server/db/schema';
import { isNull, eq } from 'drizzle-orm';
import OpenAI from 'openai';

const CONCURRENCY = 20;
const MAX_RETRIES = 3;
const LIMIT_ARG = process.argv.indexOf('--limit');
const LIMIT_N = LIMIT_ARG !== -1 ? parseInt(process.argv[LIMIT_ARG + 1] ?? '10') : null;

const key = process.env.OPENAI_KEY;
if (!key) {
	console.error('OPENAI_KEY not set');
	process.exit(1);
}

const openai = new OpenAI({ apiKey: key, timeout: 30_000 });
const db = drizzle(new Database('local.db'));

interface WordRow {
	id: number;
	hanzi: string;
	pinyin: string;
	hskLevel: number;
}

interface Sentence {
	pinyin: string;
	english: string;
}

function buildPrompt(word: WordRow): string {
	const levelHint =
		word.hskLevel <= 2
			? 'very simple, beginner'
			: word.hskLevel <= 4
				? 'everyday, intermediate'
				: 'natural, advanced';

	return `HSK ${word.hskLevel} Chinese word: ${word.hanzi} (${word.pinyin})

Reply with exactly 3 lines, nothing else. Each line is an example sentence in this exact format:
<pinyin> - <English>

IMPORTANT: the pinyin MUST use Latin letters with tone diacritics (like Wǒ, nǐ, hǎo). Do NOT write Chinese characters. Do NOT write hanzi.
Sentences should be ${levelHint} level, use ${word.hanzi} naturally, and stay under 10 English words.

Example output for 爱 (ài):
Wǒ ài wǒ de jiārén. - I love my family.
Tā ài chī miàntiáo. - She loves eating noodles.
Nǐ ài shénme yùndòng? - What sport do you love?`;
}

function parse(text: string): Sentence[] | null {
	const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
	if (lines.length !== 3) return null;

	const sentences = lines.map((line) => {
		const sep = line.indexOf(' - ');
		if (sep === -1) return null;
		return { pinyin: line.slice(0, sep).trim(), english: line.slice(sep + 3).trim() };
	});

	if (sentences.some((s) => s === null)) return null;

	const valid = sentences as Sentence[];
	if (valid.some((s) => !s.pinyin || !s.english)) return null;
	if (valid.some((s) => !/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(s.pinyin))) return null;

	return valid;
}

async function generateForWord(
	word: WordRow,
	attempt = 1
): Promise<{ data: Sentence[]; error: null } | { data: null; error: string }> {
	try {
		const response = await openai.responses.create({
			model: 'gpt-5.4-mini',
			store: false,
			service_tier: 'flex',
			input: buildPrompt(word),
			max_output_tokens: 450
		});

		const text = (response.output_text ?? '').trim();
		const parsed = parse(text);
		if (!parsed) throw new Error(`Bad format: ${text.slice(0, 200)}`);

		return { data: parsed, error: null };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (attempt < MAX_RETRIES) {
			const is429 = msg.includes('429') || msg.toLowerCase().includes('rate limit');
			await Bun.sleep(is429 ? 10_000 * attempt : 500 * attempt);
			return generateForWord(word, attempt + 1);
		}
		return { data: null, error: `(attempt ${attempt}) ${msg}` };
	}
}

async function main() {
	const allWords = await db
		.select({
			id: vocabulary.id,
			hanzi: vocabulary.hanzi,
			pinyin: vocabulary.pinyin,
			hskLevel: vocabulary.hskLevel
		})
		.from(vocabulary)
		.where(isNull(vocabulary.exampleSentences));

	const words = LIMIT_N !== null ? allWords.slice(0, LIMIT_N) : allWords;

	console.log(`${words.length} words to process`);
	if (words.length === 0) {
		console.log('Nothing to do.');
		return;
	}

	let done = 0;
	let failed = 0;
	const failedWords: Array<{ word: string; reason: string }> = [];
	const startTime = Date.now();
	const queue = [...words];

	function printSummary() {
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		console.log(`\n\nFinished in ${elapsed}s: ${done} updated, ${failed} failed`);
		if (failedWords.length > 0) {
			console.log('\nFailed words:');
			for (const { word, reason } of failedWords) console.log(`  ${word}: ${reason}`);
		}
	}

	process.on('SIGINT', () => {
		printSummary();
		process.exit(1);
	});

	function progress() {
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
		const total = done + failed;
		const pct = ((total / words.length) * 100).toFixed(1);
		const ratePerSec = total / Math.max(1, (Date.now() - startTime) / 1000);
		const remaining = Math.ceil((words.length - total) / Math.max(0.1, ratePerSec));
		process.stdout.write(
			`\r${total}/${words.length} (${pct}%) — ${failed} failed — ${elapsed}s elapsed — ~${remaining}s left   `
		);
	}

	async function worker() {
		while (queue.length > 0) {
			const word = queue.shift()!;
			const { data: sentences, error } = await generateForWord(word);

			if (sentences) {
				const exampleSentences = sentences.map((s) => `${s.pinyin} - ${s.english}`).join('\n');
				await db
					.update(vocabulary)
					.set({ exampleSentences })
					.where(eq(vocabulary.id, word.id));
				done++;
			} else {
				failed++;
				failedWords.push({ word: `${word.hanzi} (id=${word.id})`, reason: error });
				process.stderr.write(`\nFAILED ${word.hanzi} (id=${word.id}): ${error}\n`);
			}

			progress();
		}
	}

	await Promise.all(Array.from({ length: CONCURRENCY }, worker));
	printSummary();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
