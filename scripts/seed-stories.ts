/**
 * Seed six example stories (HSK1-6, one per level) into the database.
 * Idempotent: skips insert if a story with the same title already exists.
 *
 * Usage: bun scripts/seed-stories.ts
 */

import { Database } from 'bun:sqlite';
import path from 'path';

const db = new Database(path.join(import.meta.dir, '..', 'local.db'));
db.run('PRAGMA journal_mode = WAL');

// ---------------------------------------------------------------------------
// Story definitions
// ---------------------------------------------------------------------------

type WordEntry = { en: string; zh: string };
type SentenceEntry = { chinese: string; english: string; words: WordEntry[] };
type StoryDef = {
	title: string;
	titleEnglish: string;
	hskLevel: number;
	description: string;
	sentences: SentenceEntry[];
};

const STORIES: StoryDef[] = [
	{
		title: '美好的早晨',
		titleEnglish: 'A Good Morning',
		hskLevel: 1,
		description: 'A family starts their day together.',
		sentences: [
			{
				chinese: '今天天气很好。',
				english: 'The weather is very nice today.',
				words: [
					{ en: 'weather', zh: '天气' },
					{ en: 'very nice', zh: '很,好' },
					{ en: 'today', zh: '今天' }
				]
			},
			{
				chinese: '爸爸和妈妈在家。',
				english: 'Dad and Mom are at home.',
				words: [
					{ en: 'Dad', zh: '爸爸' },
					{ en: 'Mom', zh: '妈妈' },
					{ en: 'at home', zh: '在,家' }
				]
			},
			{
				chinese: '我们一起吃饭。',
				english: 'We eat together.',
				words: [
					{ en: 'We', zh: '我们' },
					{ en: 'eat', zh: '吃,饭' },
					{ en: 'together', zh: '一起' }
				]
			},
			{
				chinese: '妈妈喝茶，爸爸喝水。',
				english: 'Mom drinks tea, Dad drinks water.',
				words: [
					{ en: 'drinks tea', zh: '喝,茶' },
					{ en: 'drinks water', zh: '喝,水' }
				]
			},
			{
				chinese: '我很高兴。',
				english: 'I am very happy.',
				words: [
					{ en: 'I', zh: '我' },
					{ en: 'very happy', zh: '很,高兴' }
				]
			},
			{
				chinese: '我去学校学习汉语。',
				english: 'I go to school to study Chinese.',
				words: [
					{ en: 'go', zh: '去' },
					{ en: 'school', zh: '学校' },
					{ en: 'study', zh: '学习' },
					{ en: 'Chinese', zh: '汉语' }
				]
			},
			{
				chinese: '老师和同学们都很好。',
				english: 'The teacher and classmates are all very nice.',
				words: [
					{ en: 'teacher', zh: '老师' },
					{ en: 'classmates', zh: '同学' },
					{ en: 'all very nice', zh: '都,很,好' }
				]
			}
		]
	},
	{
		title: '朋友来了',
		titleEnglish: 'A Friend Visits',
		hskLevel: 2,
		description: 'A friend calls to say they are coming over for the weekend.',
		sentences: [
			{
				chinese: '我的朋友打电话告诉我，他要来我家。',
				english: 'My friend called to tell me he is coming to my home.',
				words: [
					{ en: 'My friend', zh: '我,朋友' },
					{ en: 'called', zh: '打,电话' },
					{ en: 'tell', zh: '告诉' },
					{ en: 'coming', zh: '来' },
					{ en: 'my home', zh: '我,家' }
				]
			},
			{
				chinese: '我已经准备好了。',
				english: 'I have already gotten ready.',
				words: [
					{ en: 'I', zh: '我' },
					{ en: 'already', zh: '已经' },
					{ en: 'ready', zh: '准备,好' }
				]
			},
			{
				chinese: '因为今天是周末，所以我们有时间。',
				english: 'Because today is the weekend, so we have time.',
				words: [
					{ en: 'Because', zh: '因为' },
					{ en: 'today', zh: '今天' },
					{ en: 'weekend', zh: '周末' },
					{ en: 'so', zh: '所以' },
					{ en: 'we', zh: '我们' },
					{ en: 'time', zh: '时间' }
				]
			},
			{
				chinese: '我想一起去看电影。',
				english: 'I want to go see a movie together.',
				words: [
					{ en: 'I want', zh: '我,想' },
					{ en: 'together', zh: '一起' },
					{ en: 'movie', zh: '电影' }
				]
			},
			{
				chinese: '我朋友觉得这个想法很好。',
				english: 'My friend thinks this idea is great.',
				words: [
					{ en: 'thinks', zh: '觉得' },
					{ en: 'idea', zh: '想法' },
					{ en: 'great', zh: '很,好' }
				]
			},
			{
				chinese: '他知道以后会更高兴。',
				english: 'He knows he will be even happier afterwards.',
				words: [
					{ en: 'He knows', zh: '他,知道' },
					{ en: 'afterwards', zh: '以后' },
					{ en: 'happier', zh: '高兴' }
				]
			}
		]
	},
	{
		title: '图书馆里的朋友',
		titleEnglish: 'Friends at the Library',
		hskLevel: 3,
		description: 'A student borrows a book and runs into a classmate with a shared passion.',
		sentences: [
			{
				chinese: '我去图书馆借了一本书。',
				english: 'I went to the library to borrow a book.',
				words: [
					{ en: 'I', zh: '我' },
					{ en: 'library', zh: '图书馆' },
					{ en: 'borrow', zh: '借' },
					{ en: 'book', zh: '书' }
				]
			},
			{
				chinese: '图书馆很安静，我很喜欢。',
				english: 'The library is very quiet and I like it a lot.',
				words: [
					{ en: 'library', zh: '图书馆' },
					{ en: 'quiet', zh: '安静' },
					{ en: 'I', zh: '我' },
					{ en: 'like', zh: '喜欢' }
				]
			},
			{
				chinese: '我看见同学小明在找书。',
				english: 'I saw my classmate Xiao Ming looking for books.',
				words: [
					{ en: 'I', zh: '我' },
					{ en: 'saw', zh: '看见' },
					{ en: 'classmate', zh: '同学' },
					{ en: 'looking for', zh: '找' },
					{ en: 'books', zh: '书' }
				]
			},
			{
				chinese: '他在找一本历史故事书。',
				english: 'He was looking for a history story book.',
				words: [
					{ en: 'He', zh: '他' },
					{ en: 'looking for', zh: '找' },
					{ en: 'history', zh: '历史' },
					{ en: 'story', zh: '故事' }
				]
			},
			{
				chinese: '借完书，我们去附近的地方说话。',
				english: 'After borrowing, we went to a nearby place to talk.',
				words: [
					{ en: 'we', zh: '我们' },
					{ en: 'nearby', zh: '附近' },
					{ en: 'place', zh: '地方' },
					{ en: 'talk', zh: '说话' }
				]
			},
			{
				chinese: '他告诉我，读书是他最大的爱好。',
				english: 'He told me that reading is his greatest hobby.',
				words: [
					{ en: 'He', zh: '他' },
					{ en: 'told', zh: '告诉' },
					{ en: 'me', zh: '我' },
					{ en: 'reading', zh: '读' },
					{ en: 'hobby', zh: '爱好' }
				]
			}
		]
	},
	{
		title: '一次旅行',
		titleEnglish: 'A Trip',
		hskLevel: 4,
		description: 'A student plans a summer trip and discovers culture along the way.',
		sentences: [
			{
				chinese: '暑假，我计划和朋友一起去南方旅游。',
				english: 'During summer vacation, I planned to travel south together with a friend.',
				words: [
					{ en: 'I', zh: '我' },
					{ en: 'planned', zh: '计划' },
					{ en: 'together', zh: '一起' },
					{ en: 'travel', zh: '旅游' }
				]
			},
			{
				chinese: '出发前，我认真了解了当地的文化和历史。',
				english: 'Before departing, I carefully learned about the local culture and history.',
				words: [
					{ en: 'departing', zh: '出发' },
					{ en: 'I', zh: '我' },
					{ en: 'carefully', zh: '认真' },
					{ en: 'learned about', zh: '了解' },
					{ en: 'culture', zh: '文化' },
					{ en: 'history', zh: '历史' }
				]
			},
			{
				chinese: '我们参观了很多有名的地方，觉得很满足。',
				english: 'We visited many famous places and felt very satisfied.',
				words: [
					{ en: 'We', zh: '我们' },
					{ en: 'visited', zh: '参观' },
					{ en: 'famous', zh: '有名' },
					{ en: 'places', zh: '地方' },
					{ en: 'felt', zh: '觉得' }
				]
			},
			{
				chinese: '虽然旅途很辛苦，但经历十分丰富。',
				english: 'Although the journey was tiring, the experience was very rich.',
				words: [
					{ en: 'Although', zh: '虽然' },
					{ en: 'experience', zh: '经历' },
					{ en: 'rich', zh: '丰富' }
				]
			},
			{
				chinese: '我们讨论了这次旅行，都觉得收获很大。',
				english: 'We discussed the trip and all felt we had gained a great deal.',
				words: [
					{ en: 'We', zh: '我们' },
					{ en: 'discussed', zh: '讨论' },
					{ en: 'felt', zh: '觉得' }
				]
			},
			{
				chinese: '这次旅游成功地让我们积累了宝贵的经历。',
				english: 'This trip successfully helped us accumulate valuable experiences.',
				words: [
					{ en: 'successfully', zh: '成功' },
					{ en: 'accumulate', zh: '积累' },
					{ en: 'experiences', zh: '经历' }
				]
			}
		]
	},
	{
		title: '城市的变化',
		titleEnglish: 'Changes in the City',
		hskLevel: 5,
		description: 'A look at how rapid growth transforms a city — and the challenges that follow.',
		sentences: [
			{
				chinese: '近几年，这座城市发生了很大的变化。',
				english: 'In recent years, this city has undergone great changes.',
				words: [
					{ en: 'city', zh: '城市' },
					{ en: 'undergone', zh: '发生' },
					{ en: 'changes', zh: '变化' }
				]
			},
			{
				chinese: '交通越来越发达，生活也越来越方便。',
				english: 'Transportation has become more advanced, and life more convenient.',
				words: [
					{ en: 'Transportation', zh: '交通' },
					{ en: 'advanced', zh: '发展' },
					{ en: 'life', zh: '生活' },
					{ en: 'convenient', zh: '方便' }
				]
			},
			{
				chinese: '然而，环境污染问题也变得越来越严重。',
				english: 'However, environmental pollution has become increasingly serious.',
				words: [
					{ en: 'However', zh: '然而' },
					{ en: 'pollution', zh: '污染' },
					{ en: 'serious', zh: '严重' }
				]
			},
			{
				chinese: '政府出台了一系列措施，号召市民积极参与保护环境。',
				english:
					'The government introduced measures, calling on citizens to actively participate in protecting the environment.',
				words: [
					{ en: 'government', zh: '政府' },
					{ en: 'measures', zh: '措施' },
					{ en: 'actively', zh: '积极' },
					{ en: 'participate', zh: '参与' },
					{ en: 'protecting', zh: '保护' }
				]
			},
			{
				chinese: '专家们分析认为，可持续发展是城市的长远目标。',
				english: 'Experts analyzed that sustainable development is the long-term goal of cities.',
				words: [
					{ en: 'analyzed', zh: '分析' },
					{ en: 'development', zh: '发展' },
					{ en: 'goal', zh: '目标' }
				]
			}
		]
	},
	{
		title: '读书的力量',
		titleEnglish: 'The Power of Reading',
		hskLevel: 6,
		description:
			'A meditation on how books shape thought, transcend time, and carry the world forward.',
		sentences: [
			{
				chinese: '阅读是学习知识、了解世界的重要方式。',
				english: 'Reading is an important way to gain knowledge and understand the world.',
				words: [
					{ en: 'Reading', zh: '阅读' },
					{ en: 'knowledge', zh: '知识' },
					{ en: 'understand', zh: '了解' }
				]
			},
			{
				chinese: '优秀的书让我们超越时空，与伟大的思想产生共鸣。',
				english:
					'Great books allow us to transcend time and space, resonating with great thoughts.',
				words: [
					{ en: 'transcend', zh: '超越' },
					{ en: 'thoughts', zh: '思想' },
					{ en: 'resonating', zh: '共鸣' }
				]
			},
			{
				chinese: '深刻的思考能改变我们看待世界的方式。',
				english: 'Deep reflection can change the way we see the world.',
				words: [
					{ en: 'Deep', zh: '深刻' },
					{ en: 'reflection', zh: '思考' },
					{ en: 'change', zh: '改变' }
				]
			},
			{
				chinese: '在信息爆炸的时代，坚持阅读尤为珍贵。',
				english:
					'In this age of information overload, persisting in reading is especially precious.',
				words: [
					{ en: 'information', zh: '信息' },
					{ en: 'age', zh: '时代' },
					{ en: 'persisting', zh: '坚持' },
					{ en: 'reading', zh: '阅读' },
					{ en: 'precious', zh: '珍贵' }
				]
			},
			{
				chinese: '读书让我们积累智慧，获得内心的力量。',
				english: 'Reading helps us accumulate wisdom and find inner strength.',
				words: [
					{ en: 'accumulate', zh: '积累' },
					{ en: 'wisdom', zh: '智慧' },
					{ en: 'strength', zh: '力量' }
				]
			}
		]
	}
];

// ---------------------------------------------------------------------------
// Insertion logic
// ---------------------------------------------------------------------------

const insertStory = db.prepare(`
	INSERT INTO stories (title, title_english, hsk_level, description, created_at)
	VALUES (?, ?, ?, ?, ?)
`);
const insertSentence = db.prepare(`
	INSERT INTO story_sentences (story_id, position, chinese, english)
	VALUES (?, ?, ?, ?)
`);
const insertWordMap = db.prepare(`
	INSERT OR IGNORE INTO word_map (en, zh) VALUES (?, ?)
`);
const lookupWordMap = db.prepare<{ id: number }, [string]>(`
	SELECT id FROM word_map WHERE en = ?
`);
const insertSentenceWord = db.prepare(`
	INSERT OR IGNORE INTO sentence_words (sentence_id, word_map_id) VALUES (?, ?)
`);
const checkExists = db.prepare<{ id: number }, [string]>(`
	SELECT id FROM stories WHERE title = ?
`);

const seedAll = db.transaction(() => {
	for (const story of STORIES) {
		const existing = checkExists.get(story.title);
		if (existing) {
			console.log(`Skipping "${story.title}" (already exists, id=${existing.id})`);
			continue;
		}

		const storyResult = insertStory.run(
			story.title,
			story.titleEnglish,
			story.hskLevel,
			story.description,
			Math.floor(Date.now() / 1000)
		);
		const storyId = Number(storyResult.lastInsertRowid);

		for (let i = 0; i < story.sentences.length; i++) {
			const s = story.sentences[i];
			const sentResult = insertSentence.run(storyId, i, s.chinese, s.english);
			const sentenceId = Number(sentResult.lastInsertRowid);

			for (const w of s.words) {
				insertWordMap.run(w.en, w.zh);
				const wm = lookupWordMap.get(w.en);
				if (!wm) throw new Error(`word_map lookup failed for en="${w.en}"`);
				insertSentenceWord.run(sentenceId, wm.id);
			}
		}

		console.log(`Inserted "${story.title}" (${story.titleEnglish}) with id=${storyId}`);
	}
});

seedAll();
db.close();
console.log('Done.');
