export type { Workflow } from './workflow_schema_module';

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
