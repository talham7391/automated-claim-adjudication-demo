import { createDb, insertSession } from '@demo/db';

export default defineEventHandler(async event => {
    const session = await insertSession(createDb(bindings(event).DB), crypto.randomUUID());
    setResponseStatus(event, 201);
    return session;
});
