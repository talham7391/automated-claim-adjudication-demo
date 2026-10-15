import { createDb, findJob, listJobProgress } from '@demo/db';

export default defineEventHandler(async event => {
    const db = createDb(bindings(event).DB);
    const job = await findJob(db, getRouterParam(event, 'jobId')!, getRouterParam(event, 'uuid')!);
    if (!job) throw createError({ statusCode: 404, statusMessage: 'Job not found' });
    return { ...job, progress: await listJobProgress(db, job.id) };
});
