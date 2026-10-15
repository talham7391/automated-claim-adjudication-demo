import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { createDb, findJob, markJobPreparing, initializeJobProgress, markJobReady, failJob } from '@demo/db';
import type { SessionWorkflowPayload } from '@demo/contracts';

export class SessionWorkflow extends WorkflowEntrypoint<Env, SessionWorkflowPayload> {
    async run(event: WorkflowEvent<SessionWorkflowPayload>, step: WorkflowStep) {
        const { jobId } = event.payload;
        const db = createDb(this.env.DB);
        try {
            const workflow = await step.do('load saved workflow', async () => {
                const job = await findJob(db, jobId);
                if (!job) throw new Error('Job not found');
                return job.workflow;
            });
            await step.do('begin preparation', () => markJobPreparing(db, jobId));
            await step.do('initialize step progress', () => initializeJobProgress(db, jobId, workflow));
            await step.do('finish preparation', () => markJobReady(db, jobId));
            return { jobId, status: 'ready' };
        } catch (error) {
            await step.do('record preparation failure', () => failJob(db, jobId,
                error instanceof Error ? error.message : String(error)));
            throw error;
        }
    }
}

export default { fetch() { return new Response('Jobs worker'); } } satisfies ExportedHandler<Env>;
