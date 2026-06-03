import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const explains = sqliteTable(
	'explains',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		vocabularyId: integer('vocabulary_id').notNull(),
		hanzi: text('hanzi').notNull(),
		pinyin: text('pinyin').notNull(),
		english: text('english').notNull(),
		userAnswer: text('user_answer').notNull(),
		explanation: text('explanation').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => ({
		vocabIdx: index('explains_vocab_idx').on(table.vocabularyId)
	})
);

export const vocabulary = sqliteTable(
	'vocabulary',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		hanzi: text('hanzi').notNull(),
		pinyin: text('pinyin').notNull(),
		pinyinPlain: text('pinyin_plain').notNull(),
		english: text('english').notNull(),
		hskLevel: integer('hsk_level').notNull(),
		learned: integer('learned', { mode: 'boolean' }).notNull().default(false),
		learnedAt: integer('learned_at', { mode: 'timestamp' }),
		starred: integer('starred', { mode: 'boolean' }).notNull().default(false),
		mistakeCount: integer('mistake_count').notNull().default(0),
		seenAt: integer('seen_at', { mode: 'timestamp' }),
		exampleSentences: text('example_sentences')
	},
	(table) => ({
		hskIdx: index('hsk_level_idx').on(table.hskLevel),
		learnedIdx: index('learned_idx').on(table.learned)
	})
);
