import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { vocabulary } from '../src/lib/server/db/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TONE_MAP: Record<string, string> = {
	ā: 'a', á: 'a', ǎ: 'a', à: 'a',
	ē: 'e', é: 'e', ě: 'e', è: 'e',
	ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
	ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
	ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
	ǖ: 'u', ǘ: 'u', ǚ: 'u', ǜ: 'u',
	ü: 'u'
};

function stripTones(pinyin: string): string {
	return pinyin
		.split('')
		.map((c) => TONE_MAP[c] ?? c)
		.join('')
		.toLowerCase();
}

const TOPIC_RULES: [string, RegExp][] = [
	['grammar', /\b(particle|measure word|modal|conjunction|preposition|pronoun|classifier|adverb|interjection|exclamation|prefix|suffix|auxiliary)\b/i],
	['numbers', /\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|million|zero|half|ordinal)\b/i],
	['time', /\b(year|month|week|day|hour|minute|second|morning|afternoon|evening|night|today|tomorrow|yesterday|o'clock|century|moment|period|season|spring|summer|autumn|fall|winter|always|never|often|sometimes|already|before|after|soon|early|late)\b/i],
	['family', /\b(father|mother|son|daughter|brother|sister|aunt|uncle|grandpa|grandma|grandfather|grandmother|wife|husband|child|children|parent|relative|sibling|cousin|nephew|niece|family)\b/i],
	['food & drink', /\b(eat|food|drink|meal|rice|noodle|bread|meat|fish|chicken|pork|beef|vegetable|fruit|water|tea|coffee|beer|wine|milk|sugar|salt|restaurant|hungry|thirsty|delicious|taste|cook|kitchen|bowl|dish|menu|flavor|spicy|sweet|sour|bitter)\b/i],
	['transport', /\b(train|bus|car|taxi|plane|airplane|airport|station|ticket|road|highway|bicycle|bike|ship|boat|subway|metro|ferry|traffic|drive|passenger|depart|arrive)\b/i],
	['body & health', /\b(head|face|eye|ear|nose|mouth|hand|foot|feet|leg|arm|heart|body|hair|tooth|teeth|neck|stomach|sick|ill|pain|hurt|doctor|hospital|medicine|health|fever|cold|cough|weight|height|exercise|blood|bone|skin|breath)\b/i],
	['nature & weather', /\b(weather|rain|snow|wind|sun|sunny|hot|cold|warm|cloud|temperature|storm|river|mountain|forest|tree|flower|grass|sea|ocean|sky|air|moon|star|earth|nature|plant|animal|cat|dog|bird|fish|panda|tiger|horse)\b/i],
	['emotions', /\b(happy|sad|angry|afraid|scared|love|hate|like|dislike|feel|feeling|hope|wish|worry|anxious|excited|bored|tired|surprised|shocked|lonely|miss|enjoy|regret|proud|embarrassed|upset|nervous|calm|satisfied|disappointed|emotion)\b/i],
	['education', /\b(school|class|study|learn|teach|teacher|student|pupil|book|write|read|exam|test|question|answer|university|college|grade|graduate|homework|lesson|subject|major|research|knowledge|understand|remember|forget|practice|review|course|lecture|library)\b/i],
	['work & business', /\b(work|job|company|office|business|career|profession|boss|employee|colleague|meeting|salary|hire|project|task|report|manage|cooperate|success|achieve|goal|plan|schedule|industry|economy|trade|market|profit|invest)\b/i],
	['shopping & money', /\b(buy|sell|shop|store|price|money|yuan|dollar|pay|cost|cheap|expensive|discount|supermarket|wallet|bank|credit|bargain|receipt|cash|spend|afford|sale|goods|product)\b/i],
	['language & communication', /\b(say|speak|talk|listen|understand|explain|introduce|word|sentence|language|translate|call|phone|message|email|letter|conversation|discuss|greet|hello|sorry|thank|promise|disagree|agree|opinion|suggest|request|invite|refuse)\b/i],
	['appearance', /\b(red|blue|green|yellow|white|black|color|orange|purple|pink|brown|gray|beautiful|pretty|handsome|ugly|tall|short|fat|thin|big|small|large|clean|dirty|round|square|style|fashion|wear|clothes|dress|shirt|pants|shoes|hat)\b/i],
	['places', /\b(city|country|town|village|home|house|room|apartment|hospital|park|street|address|everywhere|inside|outside|upstairs|downstairs|near|far|front|back|center|corner|floor|wall|door|window|garden|library|museum|cinema|hotel|building|north|south|east|west)\b/i],
	['sports & leisure', /\b(sport|play|game|run|jump|swim|dance|sing|music|art|paint|draw|photograph|watch|movie|film|internet|computer|sleep|wake|rest|vacation|holiday|hobby|relax|party|celebrate|tourism|hike|yoga|basketball|football|tennis|chess)\b/i],
	['society & culture', /\b(culture|tradition|custom|religion|history|politics|government|law|right|freedom|peace|war|society|community|nation|citizen|public|media|news|event|festival|ceremony)\b/i]
];

function detectTopic(english: string): string | null {
	for (const [topic, pattern] of TOPIC_RULES) {
		if (pattern.test(english)) return topic;
	}
	return null;
}

async function main() {
	const db = drizzle(new Database('local.db'));

	const entries: (typeof vocabulary.$inferInsert)[] = [];

	for (let level = 1; level <= 6; level++) {
		const csvPath = join(__dirname, `../static/hsk${level}.csv`);
		const content = readFileSync(csvPath, 'utf-8');
		const lines = content.split('\n').filter((line) => line.trim());

		for (const line of lines) {
			const firstComma = line.indexOf(',');
			const secondComma = line.indexOf(',', firstComma + 1);
			if (firstComma === -1 || secondComma === -1) continue;

			const hanzi = line.slice(0, firstComma).trim();
			const pinyin = line.slice(firstComma + 1, secondComma).trim();
			const english = line.slice(secondComma + 1).trim();
			if (!hanzi || !pinyin || !english) continue;

			entries.push({
				hanzi,
				pinyin,
				pinyinPlain: stripTones(pinyin),
				english,
				hskLevel: level,
				topic: detectTopic(english),
				learned: false
			});
		}

		console.log(`HSK ${level}: ${lines.length} words`);
	}

	const existing = await db.select({ hanzi: vocabulary.hanzi, hskLevel: vocabulary.hskLevel }).from(vocabulary);
	const existingSet = new Set(existing.map((e) => `${e.hanzi}:${e.hskLevel}`));
	const newEntries = entries.filter((e) => !existingSet.has(`${e.hanzi}:${e.hskLevel}`));

	const BATCH = 500;
	for (let i = 0; i < newEntries.length; i += BATCH) {
		await db.insert(vocabulary).values(newEntries.slice(i, i + BATCH));
	}

	console.log(`\nInserted ${newEntries.length} new entries (${entries.length - newEntries.length} already existed)`);

	const topicCounts: Record<string, number> = {};
	for (const e of entries) {
		const t = e.topic ?? 'uncategorized';
		topicCounts[t] = (topicCounts[t] ?? 0) + 1;
	}
	console.log('\nTopic distribution:');
	Object.entries(topicCounts)
		.sort((a, b) => b[1] - a[1])
		.forEach(([t, c]) => console.log(`  ${t}: ${c}`));
}

main().catch(console.error);
