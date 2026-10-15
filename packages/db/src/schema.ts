import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { Workflow } from '@demo/contracts';
export const sessions = sqliteTable('sessions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull().unique(),
    workflow: text('workflow', { mode: 'json' }).$type<Workflow>()
});
export const records = sqliteTable('records', { id: text('id').primaryKey(), title: text('title').notNull(), status: text('status', { enum: ['pending', 'completed'] }).notNull().default('pending'), effectCount: integer('effect_count').notNull().default(0) });
