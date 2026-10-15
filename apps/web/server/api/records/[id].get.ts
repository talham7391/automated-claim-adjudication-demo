import { createDb, findRecord } from '@demo/db';
import { workflowPayload } from '@demo/contracts';
export default defineEventHandler(async event => {
 const parsed = workflowPayload.safeParse({ recordId: getRouterParam(event, 'id') });
 if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid record ID' });
 const record = await findRecord(createDb(bindings(event).DB), parsed.data.recordId);
 if (!record) throw createError({ statusCode: 404, statusMessage: 'Record not found' });
 return record;
});
