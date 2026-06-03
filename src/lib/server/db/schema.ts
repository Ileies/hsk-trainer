import { integer, sqliteTable, text, index, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const authTokens = sqliteTable('auth_tokens', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	token: text('token').notNull().unique(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	used: integer('used', { mode: 'boolean' }).notNull().default(false)
});

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: integer('user_id').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
	},
	(t) => ({
		userIdx: index('sessions_user_idx').on(t.userId)
	})
);

export const explains = sqliteTable(
	'explains',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		vocabularyId: integer('vocabulary_id').notNull(),
		userId: integer('user_id').notNull(),
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
		vocabIdx: index('explains_vocab_idx').on(table.vocabularyId),
		userIdx: index('explains_user_idx').on(table.userId)
	})
);

export const explainsCache = sqliteTable('explains_cache', {
	vocabId: integer('vocab_id').primaryKey(),
	explanation: text('explanation').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const vocabulary = sqliteTable(
	'vocabulary',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		hanzi: text('hanzi').notNull(),
		pinyin: text('pinyin').notNull(),
		pinyinPlain: text('pinyin_plain').notNull(),
		english: text('english').notNull(),
		hskLevel: integer('hsk_level').notNull(),
		exampleSentences: text('example_sentences')
	},
	(table) => ({
		hskIdx: index('hsk_level_idx').on(table.hskLevel)
	})
);

export const userWordState = sqliteTable(
	'user_word_state',
	{
		userId: integer('user_id').notNull(),
		vocabId: integer('vocab_id').notNull(),
		learned: integer('learned', { mode: 'boolean' }).notNull().default(false),
		learnedAt: integer('learned_at', { mode: 'timestamp' }),
		starred: integer('starred', { mode: 'boolean' }).notNull().default(false),
		mistakeCount: integer('mistake_count').notNull().default(0),
		seenAt: integer('seen_at', { mode: 'timestamp' })
	},
	(t) => ({
		pk: primaryKey({ columns: [t.userId, t.vocabId] }),
		learnedIdx: index('uws_learned_idx').on(t.userId, t.learned),
		starredIdx: index('uws_starred_idx').on(t.userId, t.starred)
	})
);
