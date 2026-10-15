import { recordInput } from '@demo/contracts';
import { createDb, insertRecord } from '@demo/db';
export default defineEventHandler(async event => {
 const parsed = recordInput.safeParse(await readBody(event));
 if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid record', data: parsed.error.flatten() });
 const env = bindings(event);
 let record;
 try { record = await insertRecord(createDb(env.DB), parsed.data); } catch { throw createError({ statusCode: 409, statusMessage: 'Record ID conflict' }); }
 // Deterministic instance ID makes POST retries safe. If creation fails, retry the same POST.
 await env.RECORD_WORKFLOW.create({ id: parsed.data.id, params: { recordId: parsed.data.id } }).catch(async error => {
  try { await (await env.RECORD_WORKFLOW.get(parsed.data.id)).status(); } catch { throw error; }
 });
 setResponseStatus(event, 202);
 return record;
});
