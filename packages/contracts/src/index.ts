import { z } from 'zod';
export type { Workflow } from './workflow_schema_module';
export const recordInput = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200) });
export const workflowPayload = z.object({ recordId: z.string().uuid() });
export type RecordWorkflowPayload = z.infer<typeof workflowPayload>;

export interface JobFileInput {
    key: string;
    filename: string;
    contentType: string;
    size: number;
}

export type JobInputs = Record<string, string | number | boolean | null | JobFileInput>;
export interface SessionWorkflowPayload {
    jobId: string;
}
