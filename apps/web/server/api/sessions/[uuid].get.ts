import { createDb, findSession } from '@demo/db';

export default defineEventHandler(async event => {
    const uuid = getRouterParam(event, 'uuid')!;
    const session = await findSession(createDb(bindings(event).DB), uuid);
    if (!session) {
        throw createError({ statusCode: 404, statusMessage: 'Session not found' });
    }
    return session;
});
