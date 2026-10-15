import { z } from 'zod';
export type { Workflow } from './workflow_schema_module';
export const recordInput = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200) });
export const workflowPayload = z.object({ recordId: z.string().uuid() });
export type RecordWorkflowPayload = z.infer<typeof workflowPayload>;
