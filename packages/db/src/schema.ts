import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const sessions = sqliteTable('sessions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull().unique()
});
export const records = sqliteTable('records', { id: text('id').primaryKey(), title: text('title').notNull(), status: text('status', { enum: ['pending', 'completed'] }).notNull().default('pending'), effectCount: integer('effect_count').notNull().default(0) });
