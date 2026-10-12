import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), difficulty: text('difficulty').notNull(),
  startedAt: integer('started_at').notNull(), used: integer('used').notNull().default(0),
}, table => [index('runs_owner_started').on(table.owner, table.startedAt), index('runs_expiry').on(table.startedAt)]);
export const records = sqliteTable('records', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), difficulty: text('difficulty').notNull(), name: text('name').notNull(),
  level: integer('level').notNull(), xp: integer('xp').notNull(), score: integer('score').notNull(), updatedAt: integer('updated_at').notNull(),
}, table => [uniqueIndex('records_owner_difficulty').on(table.owner, table.difficulty), index('records_ranking').on(table.difficulty, table.score)]);
