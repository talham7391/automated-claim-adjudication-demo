import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { Workflow, JobInputs } from '@demo/contracts';

export const sessions = sqliteTable('sessions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull().unique(),
    workflow: text('workflow', { mode: 'json' }).$type<Workflow>()
});

export const jobs = sqliteTable('jobs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull().unique(),
    sessionId: text('session_id').notNull().references(() => sessions.id),
    inputs: text('inputs', { mode: 'json' }).$type<JobInputs>().notNull(),
    workflow: text('workflow', { mode: 'json' }).$type<Workflow>().notNull(),
    status: text('status', { enum: ['queued', 'preparing', 'ready', 'running', 'completed', 'failed', 'needs_review'] }).notNull().default('queued'),
    createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsec') * 1000 as integer))`),
    updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsec') * 1000 as integer))`),
    startedAt: integer('started_at'),
    completedAt: integer('completed_at'),
    error: text('error'),
    results: text('results', { mode: 'json' }).$type<Record<string, unknown>>()
}, table => [index('jobs_session_id_idx').on(table.sessionId)]);

export const jobSteps = sqliteTable('job_steps', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobId: text('job_id').notNull().references(() => jobs.id),
    stepId: text('step_id').notNull(),
    sequence: integer('sequence').notNull(),
    status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull().default('pending'),
    startedAt: integer('started_at'),
    completedAt: integer('completed_at'),
    error: text('error'),
    output: text('output', { mode: 'json' }).$type<Record<string, unknown>>()
}, table => [uniqueIndex('job_steps_job_step_idx').on(table.jobId, table.stepId)]);
