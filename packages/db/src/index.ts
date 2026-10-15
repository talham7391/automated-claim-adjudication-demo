import { drizzle } from 'drizzle-orm/d1';
import { eq, sql } from 'drizzle-orm';
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

export async function findRecord(db: Db, id: string) {
    const [record] = await db
        .select()
        .from(schema.records)
        .where(eq(schema.records.id, id));

    return record;
}

export function listRecords(db: Db) {
    return db
        .select()
        .from(schema.records)
        .orderBy(schema.records.id);
}

export async function insertRecord(db: Db, input: { id: string; title: string }) {
    await db
        .insert(schema.records)
        .values(input)
        .onConflictDoNothing();

    const record = await findRecord(db, input.id);
    if (!record || record.title !== input.title) {
        throw new Error('Record ID already belongs to another title');
    }

    return record;
}

// A single atomic statement guards both the status transition and its effect.
export async function completeRecord(db: Db, id: string) {
    await db
        .update(schema.records)
        .set({
            status: 'completed',
            effectCount: sql`${schema.records.effectCount} + 1`
        })
        .where(sql`${schema.records.id} = ${id} AND ${schema.records.status} = 'pending'`);

    const record = await findRecord(db, id);
    if (!record) {
        throw new Error('Record not found');
    }

    return record;
}
