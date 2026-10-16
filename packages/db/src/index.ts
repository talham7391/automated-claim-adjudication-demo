import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Workflow } from '@demo/contracts';
import * as schema from './schema';

export * from './schema';

export function createDb(binding: D1Database) {
    return drizzle(binding, { schema });
}

export type Db = ReturnType<typeof createDb>;

export async function findSession(db: Db, uuid: string) {
    const [session] = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.uuid, uuid));

    return session;
}

export async function insertSession(db: Db, uuid: string) {
    const [session] = await db.insert(schema.sessions).values({ uuid }).returning();
    return session!;
}

export async function saveSessionWorkflow(db: Db, uuid: string, workflow: Workflow) {
    await db
        .update(schema.sessions)
        .set({ workflow })
        .where(eq(schema.sessions.uuid, uuid));
}

export async function insertJob(db: Db, input: Pick<typeof schema.jobs.$inferInsert, 'sessionId' | 'workflow' | 'inputs' | 'uuid'>) {
    const [job] = await db.insert(schema.jobs).values(input).returning();
    return job!;
}

// Numbers identify database rows; strings identify public job UUIDs.
export async function findJob(db: Db, id: number | string, sessionId?: number | string) {
    const session = typeof sessionId === 'string' ? await findSession(db, sessionId) : undefined;
    if (typeof sessionId === 'string' && !session) return;
    const [job] = await db.select()
        .from(schema.jobs)
        .where(and(
            typeof id === 'number' ? eq(schema.jobs.id, id) : eq(schema.jobs.uuid, id),
            sessionId === undefined ? undefined : eq(schema.jobs.sessionId, String(session?.id ?? sessionId))
        ));
    return job;
}

export async function listJobs(db: Db, sessionId: number | string) {
    const session = typeof sessionId === 'string' ? await findSession(db, sessionId) : undefined;
    if (typeof sessionId === 'string' && !session) return [];
    return db.select({
        id: schema.jobs.id,
        uuid: schema.jobs.uuid,
        status: schema.jobs.status,
        createdAt: schema.jobs.createdAt,
        error: schema.jobs.error,
        description: sql<string>`json_extract(${schema.jobs.workflow}, '$.description')`
    }).from(schema.jobs)
        .where(eq(schema.jobs.sessionId, String(session?.id ?? sessionId)))
        .orderBy(desc(schema.jobs.id));
}

export async function listJobProgress(db: Db, jobId: number | string) {
    const job = await findJob(db, jobId);
    if (!job) return [];

    return db.select().from(schema.jobSteps)
        .where(eq(schema.jobSteps.jobId, String(job.id)))
        .orderBy(asc(schema.jobSteps.sequence));
}

export async function initializeJobProgress(db: Db, jobId: number | string, workflow: Workflow) {
    const job = await findJob(db, jobId);
    if (!job) throw new Error('Job not found');

    const savedSteps = await listJobProgress(db, job.id);
    const savedStepIds = new Set(savedSteps.map(step => step.stepId));

    // One insert per step avoids D1's bound-parameter limit for larger workflows.
    // Preserve existing outputs when workflow preparation is retried.
    for (const [sequence, step] of workflow.steps.entries()) {
        if (savedStepIds.has(step.id)) continue;
        await db.insert(schema.jobSteps).values({ jobId: String(job.id), stepId: step.id, sequence }).onConflictDoNothing();
        savedStepIds.add(step.id);
    }
}

export type JobSummary = Awaited<ReturnType<typeof listJobs>>[number];
export type JobDetail = NonNullable<Awaited<ReturnType<typeof findJob>>> & {
    progress: Awaited<ReturnType<typeof listJobProgress>>;
};

export type Job = typeof schema.jobs.$inferSelect;
export type JobStep = typeof schema.jobSteps.$inferSelect;

export async function markJobStatus(db: Db, jobId: string, status: 'preparing' | 'ready' | 'running') {
    const now = Date.now();
    await db.update(schema.jobs).set({
        status,
        updatedAt: now,
        ...(status === 'running' ? { startedAt: sql`coalesce(${schema.jobs.startedAt}, ${now})` } : {})
    }).where(and(eq(schema.jobs.uuid, jobId), sql`${schema.jobs.status} not in ('completed', 'failed', 'needs_review')`));
}

export async function completeJob(db: Db, jobId: string, results: Record<string, unknown>) {
    const now = Date.now();
    await db.update(schema.jobs).set({ status: 'completed', results, error: null, updatedAt: now, completedAt: now })
        .where(eq(schema.jobs.uuid, jobId));
}

export async function failJob(db: Db, jobId: string, error: string) {
    const now = Date.now();
    await db.update(schema.jobs).set({ status: 'failed', error, updatedAt: now, completedAt: now })
        .where(and(eq(schema.jobs.uuid, jobId), sql`${schema.jobs.status} not in ('completed', 'needs_review')`));
}

export async function reviewJob(db: Db, jobId: string, error: string) {
    const now = Date.now();
    await db.update(schema.jobs).set({ status: 'needs_review', error, updatedAt: now, completedAt: now })
        .where(and(eq(schema.jobs.uuid, jobId), sql`${schema.jobs.status} not in ('completed', 'failed')`));
}

export async function startJobStep(db: Db, stepId: number) {
    const now = Date.now();
    await db.update(schema.jobSteps).set({ status: 'running', startedAt: sql`coalesce(${schema.jobSteps.startedAt}, ${now})` })
        .where(and(eq(schema.jobSteps.id, stepId), sql`${schema.jobSteps.status} in ('pending', 'running')`));
}

export async function completeJobStep(db: Db, stepId: number, output: Record<string, unknown>) {
    await db.update(schema.jobSteps).set({ status: 'completed', output, error: null, completedAt: Date.now() })
        .where(eq(schema.jobSteps.id, stepId));
}

export async function failJobStep(db: Db, stepId: number, error: string) {
    await db.update(schema.jobSteps).set({ status: 'failed', error, completedAt: Date.now() })
        .where(and(eq(schema.jobSteps.id, stepId), sql`${schema.jobSteps.status} != 'completed'`));
}
