import type { JobInputs } from '@demo/contracts';
import { createDb, failJob, findSession, insertJob } from '@demo/db';

export default defineEventHandler(async event => {
    const env = bindings(event);
    const db = createDb(env.DB);
    const sessionUuid = getRouterParam(event, 'uuid')!;
    const session = await findSession(db, sessionUuid);
    if (!session) throw createError({ statusCode: 404, statusMessage: 'Session not found' });
    if (!session.workflow) throw createError({ statusCode: 409, statusMessage: 'No workflow saved' });

    const parts = await readMultipartFormData(event);
    const inputs: JobInputs = JSON.parse(parts?.find(part => part.name === 'inputs')?.data.toString() ?? '{}');
    const jobId = crypto.randomUUID();
    const uploadedKeys: string[] = [];
    let job;
    try {
        for (const [inputId, field] of Object.entries(session.workflow.inputs)) {
            if (field.type !== 'file') continue;
            const file = parts?.find(part => part.name === inputId && part.filename !== undefined);
            if (!file) continue;
            const key = `${sessionUuid}/${jobId}/${inputId}`;
            await env.JOB_UPLOADS.put(key, file.data, {
                httpMetadata: { contentType: file.type ?? 'application/octet-stream' }
            });
            uploadedKeys.push(key);
            inputs[inputId] = {
                key,
                filename: file.filename!,
                contentType: file.type ?? 'application/octet-stream',
                size: file.data.length
            };
        }
        job = await insertJob(db, { uuid: jobId, sessionId: String(session.id), workflow: session.workflow, inputs });
    } catch (error) {
        await Promise.allSettled(uploadedKeys.map(key => env.JOB_UPLOADS.delete(key)));
        throw error;
    }

    try {
        await env.SESSION_WORKFLOW.create({ id: job.uuid, params: { jobId: job.uuid } });
    } catch (error) {
        // A lost create response may still mean the durable instance exists.
        try {
            await (await env.SESSION_WORKFLOW.get(jobId)).status();
        } catch {
            await failJob(db, jobId, error instanceof Error ? error.message : String(error));
            throw createError({ statusCode: 503, statusMessage: 'Unable to start background job', data: { jobId } });
        }
    }
    setResponseStatus(event, 202);
    return job;
});
