import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { createDb, findRecord, completeRecord, findJob, markJobPreparing, initializeJobProgress, markJobReady, failJob } from '@demo/db';
import { workflowPayload, type SessionWorkflowPayload, type RecordWorkflowPayload } from '@demo/contracts';
export class RecordWorkflow extends WorkflowEntrypoint<Env, RecordWorkflowPayload> {
 async run(event: WorkflowEvent<RecordWorkflowPayload>, step: WorkflowStep) {
  const { recordId } = workflowPayload.parse(event.payload);
  await step.do('read record', async () => {
   const record = await findRecord(createDb(this.env.DB), recordId);
   if (!record) throw new Error('Record not found');
   return record;
  });
  return step.do('complete record', () => completeRecord(createDb(this.env.DB), recordId));
 }
}
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
