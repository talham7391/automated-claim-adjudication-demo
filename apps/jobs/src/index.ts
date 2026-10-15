import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { createDb, findRecord, completeRecord } from '@demo/db';
import { workflowPayload, type RecordWorkflowPayload } from '@demo/contracts';
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
export default { fetch() { return new Response('Jobs worker'); } } satisfies ExportedHandler<Env>;
