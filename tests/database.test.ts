import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createDb, insertRecord, completeRecord, findRecord } from '../packages/db/src/index';

test('shared queries migrate an empty store and tolerate a repeated workflow effect', async () => {
 const sqlite = new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../packages/db/migrations/0000_records.sql', import.meta.url), 'utf8'));
 // D1's prepared statement interface backed by real SQLite for the shared query test.
 const binding = {
  prepare(sql: string) {
   let values: any[] = [];
   const statement = {
    bind(...args: any[]) { values = args; return statement; },
    async all() { return { results: sqlite.prepare(sql).all(...values), success: true, meta: {} }; },
    async run() { return { results: [], success: true, meta: sqlite.prepare(sql).run(...values) }; },
    async raw() { return sqlite.prepare(sql).all(...values).map(row => Object.values(row)); },
   };
   return statement;
  },
 } as unknown as D1Database;
 const db = createDb(binding);
 const input = { id: 'retry-test', title: 'Retry test' };
 await insertRecord(db, input);
 await insertRecord(db, input);
 await completeRecord(db, input.id);
 await completeRecord(db, input.id);
 assert.deepEqual(await findRecord(db, input.id), { ...input, status: 'completed', effectCount: 1 });
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM records').get()!.count, 1);
 await assert.rejects(insertRecord(db, { ...input, title: 'conflict' }));
 await assert.rejects(completeRecord(db, 'missing'));
 sqlite.close();
});
