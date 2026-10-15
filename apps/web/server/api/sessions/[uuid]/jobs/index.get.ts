import { createDb, findSession, listJobs } from '@demo/db';

export default defineEventHandler(async event => {
    const db = createDb(bindings(event).DB);
    const sessionUuid = getRouterParam(event, 'uuid')!;
    if (!await findSession(db, sessionUuid)) {
        throw createError({ statusCode: 404, statusMessage: 'Session not found' });
    }
    return listJobs(db, sessionUuid);
});
