#!/usr/bin/env bun
/**
 * Rewrite stories 2-6 with coherent narratives and complete word-level translations.
 *
 * Conventions:
 *  - word_map.en: keyword/phrase, ideally appearing (case-insensitive, word-boundary)
 *    in the english sentence so the english side highlights it. If it does not appear
 *    in english, the entry still serves the Chinese-side highlight + WordCard view.
 *  - word_map.zh: a comma-separated list of vocab hanzi segments. WordCard looks each
 *    segment up in the vocabulary table for pinyin/english display.
 *  - Story 1 must keep working: any existing word_map row referenced by story 1
 *    sentences must not have its zh value mutated by this script.
 */
import { Database } from 'bun:sqlite';
import path from 'path';

const db = new Database(path.join(import.meta.dir, '..', 'local.db'));
db.run('PRAGMA foreign_keys = ON');

type WordRef = [en: string, zh: string];

type Sentence = {
	chinese: string;
	english: string;
	words: WordRef[];
};

type Story = {
	id: number;
	title: string;
	titleEnglish: string;
	hskLevel: number;
	description: string;
	sentences: Sentence[];
};

const stories: Story[] = [
	{
		id: 2,
		title: '朋友来我家',
		titleEnglish: 'A Friend Comes Over',
		hskLevel: 2,
		description: 'A friend visits for the weekend, and the family enjoys a happy day together.',
		sentences: [
			{
				chinese: '今天是星期六，我的朋友来我家。',
				english: 'Today is Saturday, my friend is coming to my home.',
				words: [
					['today', '今天'],
					['is', '是'],
					['saturday', '星期,六'],
					['my friend', '朋友'],
					['coming', '来'],
					['my home', '家']
				]
			},
			{
				chinese: '他坐火车来，下午三点到。',
				english: 'He takes the train and arrives in the afternoon.',
				words: [
					['he', '他'],
					['takes', '坐'],
					['train', '火,车'],
					['arrives', '到'],
					['afternoon', '下午']
				]
			},
			{
				chinese: '妈妈和我一起做菜。',
				english: 'Mom and I cook together.',
				words: [
					['mom', '妈妈'],
					['and', '和'],
					['i', '我'],
					['cook', '做,菜'],
					['together', '一起']
				]
			},
			{
				chinese: '我们喜欢吃中国菜，也喜欢喝茶。',
				english: 'We like to eat Chinese food, and we also like to drink tea.',
				words: [
					['we', '我们'],
					['like', '喜欢'],
					['eat', '吃'],
					['chinese food', '中国,菜'],
					['also', '也'],
					['drink', '喝'],
					['tea', '茶']
				]
			},
			{
				chinese: '朋友说我家很漂亮。',
				english: 'My friend says my home is very beautiful.',
				words: [
					['my friend', '朋友'],
					['says', '说'],
					['my home', '家'],
					['very', '很'],
					['beautiful', '漂亮']
				]
			},
			{
				chinese: '晚上我们一起看电视，非常高兴。',
				english: 'In the evening, we watch TV together and feel extremely happy.',
				words: [
					['evening', '晚上'],
					['we', '我们'],
					['watch', '看'],
					['tv', '电视'],
					['together', '一起'],
					['extremely', '非常'],
					['happy', '高兴']
				]
			},
			{
				chinese: '明天他想去公园玩。',
				english: 'Tomorrow he wants to go to the park to play.',
				words: [
					['tomorrow', '明天'],
					['he', '他'],
					['wants', '想'],
					['go', '去'],
					['park', '公园'],
					['play', '玩']
				]
			}
		]
	},
	{
		id: 3,
		title: '图书馆里的朋友',
		titleEnglish: 'A Friend at the Library',
		hskLevel: 3,
		description:
			'A weekend study session at the library leads to a chance meeting with a classmate.',
		sentences: [
			{
				chinese: '周末，我去图书馆看书。',
				english: 'On the weekend, I go to the library to read books.',
				words: [
					['weekend', '周末'],
					['i', '我'],
					['go', '去'],
					['library', '图书馆'],
					['read books', '看,书']
				]
			},
			{
				chinese: '图书馆里很安静，许多人在认真学习。',
				english: 'The library is very quiet, and many people are studying attentively.',
				words: [
					['library', '图书馆'],
					['very', '很'],
					['quiet', '安静'],
					['many', '许多'],
					['people', '人'],
					['studying', '学习'],
					['attentively', '认真']
				]
			},
			{
				chinese: '我遇到了同学小明。',
				english: 'I ran into my classmate Xiao Ming.',
				words: [
					['i', '我'],
					['ran into', '遇到'],
					['classmate', '同学']
				]
			},
			{
				chinese: '他正在找一本关于历史的书。',
				english: 'He is looking for a book about history.',
				words: [
					['he', '他'],
					['is currently', '正在'],
					['looking for', '找'],
					['a', '一,本'],
					['book', '书'],
					['about', '关于'],
					['history', '历史']
				]
			},
			{
				chinese: '我们一起复习了两个小时的汉语。',
				english: 'We reviewed Chinese together for two hours.',
				words: [
					['we', '我们'],
					['reviewed', '复习'],
					['chinese', '汉语'],
					['together', '一起'],
					['two', '两'],
					['hours', '小时']
				]
			},
			{
				chinese: '然后我们去附近的咖啡店休息。',
				english: 'Then we went to a nearby coffee shop to rest.',
				words: [
					['then', '然后'],
					['we', '我们'],
					['went', '去'],
					['nearby', '附近'],
					['coffee shop', '咖啡,店'],
					['rest', '休息']
				]
			},
			{
				chinese: '小明告诉我，读书是他最大的爱好。',
				english: 'Xiao Ming told me that reading books is his greatest hobby.',
				words: [
					['told', '告诉'],
					['me', '我'],
					['reading books', '读,书'],
					['is', '是'],
					['his', '他'],
					['greatest', '最,大'],
					['hobby', '爱好']
				]
			},
			{
				chinese: '有朋友一起学习，真的很愉快。',
				english: 'Studying together with a friend is really enjoyable.',
				words: [
					['studying', '学习'],
					['together', '一起'],
					['friend', '朋友'],
					['really', '真'],
					['enjoyable', '愉快']
				]
			}
		]
	},
	{
		id: 4,
		title: '云南之旅',
		titleEnglish: 'A Trip to Yunnan',
		hskLevel: 4,
		description:
			'A summer trip to Yunnan reveals the beauty of local culture and leaves a lasting impression.',
		sentences: [
			{
				chinese: '暑假的时候，我和朋友一起去云南旅游。',
				english: 'During summer vacation, my friend and I traveled to Yunnan together.',
				words: [
					['during', '的时候'],
					['my friend', '朋友'],
					['and', '和'],
					['i', '我'],
					['traveled', '旅游'],
					['together', '一起']
				]
			},
			{
				chinese: '出发前，我们仔细地准备了所有的东西。',
				english: 'Before leaving, we carefully prepared everything we needed.',
				words: [
					['before leaving', '出发,前'],
					['we', '我们'],
					['carefully', '仔细'],
					['prepared', '准备'],
					['everything', '所有'],
					['needed', '东西']
				]
			},
			{
				chinese: '我们坐飞机从北京到昆明，大约花了三个小时。',
				english: 'We flew from Beijing to Kunming, which took about three hours.',
				words: [
					['we', '我们'],
					['flew', '坐,飞机'],
					['from', '从'],
					['beijing', '北京'],
					['to', '到'],
					['about', '大约'],
					['took', '花'],
					['three', '三'],
					['hours', '小时']
				]
			},
			{
				chinese: '那里的风景非常美丽，我们参观了许多有名的地方。',
				english: 'The scenery there was extremely beautiful, and we visited many famous places.',
				words: [
					['there', '那里'],
					['scenery', '风景'],
					['extremely', '非常'],
					['beautiful', '美丽'],
					['we', '我们'],
					['visited', '参观'],
					['many', '许多'],
					['famous', '有名'],
					['places', '地方']
				]
			},
			{
				chinese: '我对当地的少数民族文化特别感兴趣。',
				english: 'I am especially interested in the local ethnic minority culture.',
				words: [
					['i', '我'],
					['interested in', '对,感兴趣'],
					['local', '当地'],
					['ethnic minority', '民族'],
					['culture', '文化'],
					['especially', '特别']
				]
			},
			{
				chinese: '虽然旅行的时间不长，但是给我留下了深刻的印象。',
				english: 'Although the trip was not long, it left me with a deep impression.',
				words: [
					['although', '虽然'],
					['trip', '旅行'],
					['time', '时间'],
					['long', '长'],
					['but', '但是'],
					['left', '留'],
					['me', '我'],
					['deep', '深刻'],
					['impression', '印象']
				]
			},
			{
				chinese: '我希望以后还能再去一次。',
				english: 'I hope I can go again sometime in the future.',
				words: [
					['i', '我'],
					['hope', '希望'],
					['in the future', '以后'],
					['can', '能'],
					['again', '再'],
					['go', '去']
				]
			}
		]
	},
	{
		id: 5,
		title: '城市的变化',
		titleEnglish: 'Changes in the City',
		hskLevel: 5,
		description:
			'A reflection on how a city has transformed and the challenges that rapid growth brings.',
		sentences: [
			{
				chinese: '这些年来，我居住的城市发生了惊人的变化。',
				english: 'In recent years, the city where I live has undergone astonishing changes.',
				words: [
					['recent years', '这些,年'],
					['i', '我'],
					['live', '居住'],
					['city', '城市'],
					['undergone', '发生'],
					['astonishing', '惊人'],
					['changes', '变化']
				]
			},
			{
				chinese: '不仅高楼大厦越来越多，地铁线路也在不断扩展。',
				english:
					'Not only are skyscrapers multiplying, but the subway network is also continually expanding.',
				words: [
					['not only', '不仅'],
					['skyscrapers', '大厦'],
					['multiplying', '越来越,多'],
					['subway', '地铁'],
					['network', '线路'],
					['also', '也'],
					['continually', '不断'],
					['expanding', '扩展']
				]
			},
			{
				chinese: '然而，随着经济的快速发展，环境污染问题也日益严重。',
				english:
					'However, as the economy develops rapidly, the problem of environmental pollution is also growing more serious by the day.',
				words: [
					['however', '然而'],
					['as', '随着'],
					['economy', '经济'],
					['rapidly', '快速'],
					['develops', '发展'],
					['environmental', '环境'],
					['pollution', '污染'],
					['problem', '问题'],
					['also', '也'],
					['by the day', '日益'],
					['serious', '严重']
				]
			},
			{
				chinese: '为了改善空气质量，政府出台了一系列严格的措施。',
				english:
					'In order to improve air quality, the government has introduced a series of strict measures.',
				words: [
					['in order to', '为了'],
					['improve', '改善'],
					['air', '空气'],
					['quality', '质量'],
					['government', '政府'],
					['introduced', '出台'],
					['strict', '严格'],
					['measures', '措施']
				]
			},
			{
				chinese: '与此同时，市民们也积极参与各种环保活动。',
				english:
					'At the same time, citizens are also actively taking part in various environmental activities.',
				words: [
					['at the same time', '同时'],
					['citizens', '市民'],
					['also', '也'],
					['actively', '积极'],
					['taking part', '参与'],
					['various', '各种'],
					['environmental', '环保'],
					['activities', '活动']
				]
			},
			{
				chinese: '专家普遍认为，可持续发展才是城市未来真正的方向。',
				english:
					'Experts widely believe that sustainable development is truly the direction for the city’s future.',
				words: [
					['experts', '专家'],
					['widely', '普遍'],
					['believe', '认为'],
					['sustainable development', '发展'],
					['city', '城市'],
					['future', '未来'],
					['truly', '真正'],
					['direction', '方向']
				]
			}
		]
	},
	{
		id: 6,
		title: '阅读的力量',
		titleEnglish: 'The Power of Reading',
		hskLevel: 6,
		description:
			'A meditation on how reading shapes thought, transcends time, and enriches the inner world.',
		sentences: [
			{
				chinese: '阅读是人类获取知识、传承文明的重要途径。',
				english:
					'Reading is an important means by which humanity acquires knowledge and passes down civilization.',
				words: [
					['reading', '阅读'],
					['is', '是'],
					['humanity', '人类'],
					['acquires', '获取'],
					['knowledge', '知识'],
					['passes down', '传承'],
					['civilization', '文明'],
					['important', '重要'],
					['means', '途径']
				]
			},
			{
				chinese: '一本优秀的书能够跨越时空，让读者与伟大的思想产生共鸣。',
				english:
					'An outstanding book can transcend time and space, letting the reader resonate with great ideas.',
				words: [
					['outstanding', '优秀'],
					['book', '书'],
					['can', '能够'],
					['transcend', '跨越'],
					['time and space', '时,空'],
					['letting', '让'],
					['reader', '读者'],
					['resonate', '共鸣'],
					['with', '与'],
					['great', '伟大'],
					['ideas', '思想']
				]
			},
			{
				chinese: '通过深入的思考，我们才能真正理解作者想要表达的意思。',
				english:
					'Through deep reflection, we can truly understand the meaning the author wants to express.',
				words: [
					['through', '通过'],
					['deep reflection', '深入,思考'],
					['we', '我们'],
					['truly', '真正'],
					['understand', '理解'],
					['meaning', '意思'],
					['author', '作者'],
					['wants to', '想要'],
					['express', '表达']
				]
			},
			{
				chinese: '在信息泛滥的时代，专注阅读显得尤为珍贵。',
				english: 'In an era of information overload, focused reading appears especially precious.',
				words: [
					['information', '信息'],
					['overload', '泛滥'],
					['era', '时代'],
					['focused reading', '专注,阅读'],
					['appears', '显得'],
					['especially', '尤为'],
					['precious', '珍贵']
				]
			},
			{
				chinese: '长期坚持阅读的人，往往拥有更开阔的视野和更丰富的内心世界。',
				english:
					'Those who consistently read over the long term often have broader horizons and a richer inner world.',
				words: [
					['long term', '长期'],
					['consistently', '坚持'],
					['read', '阅读'],
					['often', '往往'],
					['have', '拥有'],
					['broader', '开阔'],
					['horizons', '视野'],
					['richer', '丰富'],
					['inner', '内心'],
					['world', '世界']
				]
			},
			{
				chinese: '读一本好书就像与一位智者长谈，能够启迪心灵，照亮人生。',
				english:
					'Reading a good book is like having a long conversation with a wise person; it enlightens the soul and illuminates life.',
				words: [
					['reading', '读'],
					['a good book', '好,书'],
					['is like', '就,像'],
					['with', '与'],
					['wise person', '智者'],
					['long conversation', '长,谈'],
					['enlightens', '启迪'],
					['soul', '心灵'],
					['illuminates', '照亮'],
					['life', '人生']
				]
			}
		]
	}
];

// English keys whose word_map row is referenced by story 1 sentences. The script must
// not change their zh value, since that would corrupt story 1's highlighting.
const STORY1_PROTECTED: Record<string, string> = {
	'the weather': '天气',
	very: '很',
	today: '今天',
	is: '是',
	nice: '好',
	dad: '爸爸',
	mom: '妈妈',
	at: '在',
	and: '和',
	are: '是',
	home: '家',
	we: '我们',
	eat: '吃',
	together: '一起',
	food: '饭',
	tea: '茶',
	water: '水',
	drinks: '喝',
	i: '我',
	happy: '高兴',
	am: '是',
	go: '去',
	school: '学校',
	study: '学习',
	chinese: '汉语',
	'the teacher': '老师',
	classmates: '同学',
	all: '都'
};

// Verify that my new (en, zh) pairs never conflict with story-1 protected values.
for (const story of stories) {
	for (const s of story.sentences) {
		for (const [en, zh] of s.words) {
			const protectedZh = STORY1_PROTECTED[en];
			if (protectedZh && protectedZh !== zh) {
				throw new Error(
					`Story ${story.id} sentence "${s.chinese}": key "${en}" would overwrite story-1 protected zh "${protectedZh}" with "${zh}"`
				);
			}
		}
	}
}

const tx = db.transaction(() => {
	const deleteSWStmt = db.prepare(
		'DELETE FROM sentence_words WHERE sentence_id IN (SELECT id FROM story_sentences WHERE story_id = ?)'
	);
	const deleteSSStmt = db.prepare('DELETE FROM story_sentences WHERE story_id = ?');
	const updateStoryStmt = db.prepare(
		'UPDATE stories SET title = ?, title_english = ?, hsk_level = ?, description = ? WHERE id = ?'
	);
	const insertSSStmt = db.prepare(
		'INSERT INTO story_sentences (story_id, position, chinese, english) VALUES (?, ?, ?, ?)'
	);
	const findWMStmt = db.prepare('SELECT id, zh FROM word_map WHERE en = ?');
	const insertWMStmt = db.prepare('INSERT INTO word_map (en, zh) VALUES (?, ?)');
	const updateWMStmt = db.prepare('UPDATE word_map SET zh = ? WHERE id = ?');
	const insertSWStmt = db.prepare(
		'INSERT OR IGNORE INTO sentence_words (sentence_id, word_map_id) VALUES (?, ?)'
	);

	let warnings = 0;
	for (const story of stories) {
		deleteSWStmt.run(story.id);
		deleteSSStmt.run(story.id);
		updateStoryStmt.run(
			story.title,
			story.titleEnglish,
			story.hskLevel,
			story.description,
			story.id
		);

		story.sentences.forEach((sentence, position) => {
			const result = insertSSStmt.run(story.id, position, sentence.chinese, sentence.english);
			const sentenceId = Number(result.lastInsertRowid);

			for (const [en, zh] of sentence.words) {
				// sanity check: every zh segment must occur in the chinese sentence
				for (const seg of zh
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)) {
					if (!sentence.chinese.includes(seg)) {
						console.warn(
							`WARN story ${story.id} pos ${position}: zh segment "${seg}" for en "${en}" not found in "${sentence.chinese}"`
						);
						warnings++;
					}
				}

				const existing = findWMStmt.get(en) as { id: number; zh: string } | undefined;
				let wmId: number;
				if (existing) {
					if (existing.zh !== zh) {
						if (STORY1_PROTECTED[en]) {
							throw new Error(`Refusing to overwrite story-1 entry "${en}"`);
						}
						updateWMStmt.run(zh, existing.id);
					}
					wmId = existing.id;
				} else {
					const r = insertWMStmt.run(en, zh);
					wmId = Number(r.lastInsertRowid);
				}
				insertSWStmt.run(sentenceId, wmId);
			}
		});
	}
	if (warnings > 0) {
		console.warn(`\n${warnings} segment-not-in-sentence warning(s) above.`);
	}
});

tx();
console.log('Done. Stories 2-6 rewritten.\n');

const counts = db
	.prepare(
		`SELECT s.id, s.title, s.title_english, s.hsk_level,
		        (SELECT COUNT(*) FROM story_sentences WHERE story_id = s.id) AS sentences,
		        (SELECT COUNT(*) FROM sentence_words sw JOIN story_sentences ss ON sw.sentence_id = ss.id WHERE ss.story_id = s.id) AS word_links
		 FROM stories s ORDER BY s.id`
	)
	.all();
console.table(counts);
