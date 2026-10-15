import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Workflow } from '@demo/contracts';
import * as schema from './schema';

export * from './schema';

export function createDb(binding: D1Database) {
    return drizzle(binding, { schema });
}

type Db = ReturnType<typeof createDb>;

export async function findSession(db: Db, uuid: string) {
    const [session] = await db
        .select({ uuid: schema.sessions.uuid, workflow: schema.sessions.workflow })
        .from(schema.sessions)
        .where(eq(schema.sessions.uuid, uuid));

    return session;
}

export async function insertSession(db: Db, uuid: string) {
    await db.insert(schema.sessions).values({ uuid });

    return { uuid, workflow: null };
}

export async function saveSessionWorkflow(db: Db, uuid: string, workflow: Workflow) {
    await db
        .update(schema.sessions)
        .set({ workflow })
        .where(eq(schema.sessions.uuid, uuid));
}

export async function insertJob(db: Db, input: Pick<typeof schema.jobs.$inferInsert, 'id' | 'sessionUuid' | 'workflow' | 'inputs'>) {
    const now = Date.now();
    const [job] = await db.insert(schema.jobs).values({ ...input, createdAt: now, updatedAt: now }).returning();
    return job;
}

export async function findJob(db: Db, id: string, sessionUuid?: string) {
    const [job] = await db.select().from(schema.jobs).where(and(
        eq(schema.jobs.id, id),
        sessionUuid === undefined ? undefined : eq(schema.jobs.sessionUuid, sessionUuid)
    ));
    return job;
}

export function listJobs(db: Db, sessionUuid: string) {
    return db.select({
        id: schema.jobs.id,
        status: schema.jobs.status,
        createdAt: schema.jobs.createdAt,
        updatedAt: schema.jobs.updatedAt,
        description: sql<string>`json_extract(${schema.jobs.workflow}, '$.description')`,
        error: schema.jobs.error
    }).from(schema.jobs).where(eq(schema.jobs.sessionUuid, sessionUuid))
        .orderBy(desc(schema.jobs.createdAt), desc(schema.jobs.id));
}

export function listJobProgress(db: Db, jobId: string) {
    return db.select().from(schema.workflowProgress)
        .where(eq(schema.workflowProgress.jobId, jobId))
        .orderBy(asc(schema.workflowProgress.position));
}

export async function markJobPreparing(db: Db, jobId: string) {
    const now = Date.now();
    await db.update(schema.jobs).set({ status: 'preparing', startedAt: now, updatedAt: now })
        .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.status, 'queued')));
}

export async function initializeJobProgress(db: Db, jobId: string, workflow: Workflow) {
    // One insert per step avoids D1's bound-parameter limit for larger workflows.
    for (const [position, step] of workflow.steps.entries()) {
        await db.insert(schema.workflowProgress).values({ jobId, stepId: step.id, position })
            .onConflictDoNothing();
    }
}

export async function markJobReady(db: Db, jobId: string) {
    await db.update(schema.jobs).set({ status: 'ready', updatedAt: Date.now() })
        .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.status, 'preparing')));
}

export async function failJob(db: Db, jobId: string, error: string) {
    const now = Date.now();
    await db.update(schema.jobs).set({ status: 'failed', error, updatedAt: now, completedAt: now })
        .where(and(eq(schema.jobs.id, jobId), sql`${schema.jobs.status} IN ('queued', 'preparing')`));
}

export type JobSummary = Awaited<ReturnType<typeof listJobs>>[number];
export type JobDetail = NonNullable<Awaited<ReturnType<typeof findJob>>> & {
    progress: Awaited<ReturnType<typeof listJobProgress>>;
};
