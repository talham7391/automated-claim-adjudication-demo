import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { Workflow, JobInputs } from '@demo/contracts';
export const sessions = sqliteTable('sessions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull().unique(),
    workflow: text('workflow', { mode: 'json' }).$type<Workflow>()
});

export const jobs = sqliteTable('jobs', {
    id: text('id').primaryKey(),
    sessionUuid: text('session_uuid').notNull().references(() => sessions.uuid),
    workflow: text('workflow', { mode: 'json' }).$type<Workflow>().notNull(),
    inputs: text('inputs', { mode: 'json' }).$type<JobInputs>().notNull(),
    status: text('status', { enum: ['queued', 'preparing', 'ready', 'running', 'completed', 'failed'] }).notNull().default('queued'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    startedAt: integer('started_at'),
    completedAt: integer('completed_at'),
    error: text('error'),
    results: text('results', { mode: 'json' }).$type<Record<string, unknown>>()
}, table => [index('jobs_session_created_idx').on(table.sessionUuid, table.createdAt)]);

export const workflowProgress = sqliteTable('workflow_progress', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobId: text('job_id').notNull().references(() => jobs.id),
    stepId: text('step_id').notNull(),
    position: integer('position').notNull(),
    status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull().default('pending'),
    startedAt: integer('started_at'),
    completedAt: integer('completed_at'),
    error: text('error'),
    output: text('output', { mode: 'json' }).$type<Record<string, unknown>>()
}, table => [uniqueIndex('workflow_progress_job_step_idx').on(table.jobId, table.stepId)]);
