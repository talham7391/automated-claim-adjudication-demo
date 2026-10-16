import { z } from 'zod';

export type Fields<T> = Record<string, T>;

export interface NamedField {
    name: string;
    description: string;
}

export type FieldDefinition = NamedField & (
    | { type: 'string'; enum?: string[] }
    | { type: 'number'; enum?: number[] }
    | { type: 'boolean' }
    | { type: 'file' }
);

export interface FieldReference {
    // ID of a workflow input or an earlier step's output.
    // Workflow outputs reference step outputs.
    referenceId: string;
}

export type ApiOutput = FieldDefinition & {
    // Dot-separated attribute path within the JSON response body.
    source: string;
};

export interface ExtractConfig {
    instructions: string;
}

export interface AiConfig {
    instructions: string;
}

export interface ApiConfig {
    returnValue: string;
}

export interface StepBase {
    id: string;
    name: string;
    description: string;
    inputs: Fields<FieldReference>;
}

export type Step = StepBase & (
    | {
        type: 'extract';
        config: ExtractConfig;
        outputs: Fields<FieldDefinition>;
    }
    | {
        type: 'reason';
        config: AiConfig;
        outputs: Fields<FieldDefinition>;
    }
    | {
        type: 'api';
        config: ApiConfig;
        outputs: Fields<ApiOutput>;
    }
);

export interface Workflow {
    _schemaVersion: '0.0.1';
    description: string;
    inputs: Fields<FieldDefinition>;
    steps: Step[];
    outputs: Fields<FieldReference>;
}

const id = z.string();
const namedField = {
    name: z.string().trim().min(1),
    description: z.string()
};

const fieldDefinition: z.ZodType<FieldDefinition> = z.discriminatedUnion('type', [
    z.object({ ...namedField, type: z.literal('string'), enum: z.array(z.string()).nonempty().optional() }),
    z.object({ ...namedField, type: z.literal('number'), enum: z.array(z.number()).nonempty().optional() }),
    z.object({ ...namedField, type: z.literal('boolean') }),
    z.object({ ...namedField, type: z.literal('file') })
]);

const fieldReference = z.object({ referenceId: id });
const apiOutput = z.intersection(fieldDefinition, z.object({
    source: z.string().regex(/^[^.\s/]+(?:\.[^.\s/]+)*$/, 'Use a dot-separated JSON attribute path')
}));
const extractConfig = z.object({
    instructions: z.string().trim().min(1)
});
const aiConfig = z.object({
    instructions: z.string().trim().min(1)
});
const stepBase = {
    id: id,
    ...namedField,
    inputs: z.record(id, fieldReference)
};
const stepDefinition = z.discriminatedUnion('type', [
    z.object({ ...stepBase, type: z.literal('extract'), config: extractConfig, outputs: z.record(id, fieldDefinition) }),
    z.object({ ...stepBase, type: z.literal('reason'), config: aiConfig, outputs: z.record(id, fieldDefinition) }),
    z.object({
        ...stepBase,
        type: z.literal('api'),
        config: z.object({
            returnValue: z.string()
        }),
        outputs: z.record(id, apiOutput)
    })
]);

const workflowDefinition = z.object({
    _schemaVersion: z.literal('0.0.1'),
    description: z.string(),
    inputs: z.record(id, fieldDefinition),
    steps: z.array(stepDefinition).nonempty(),
    outputs: z.record(id, fieldReference)
}).superRefine((workflow, context) => {
    const ids = new Set<string>();
    const availableInputs = new Set<string>();
    const availableOutputs = new Set<string>();

    const registerId = (id: string, path: (string | number)[]) => {
        if (ids.has(id)) {
            context.addIssue({ code: 'custom', path, message: 'ID must be unique throughout the workflow' });
        }
        ids.add(id);
    };

    const registerFields = (fields: Fields<FieldDefinition>, path: (string | number)[]) => {
        for (const id of Object.keys(fields)) {
            registerId(id, [...path, id]);
        }
    };

    registerFields(workflow.inputs, ['inputs']);
    for (const id of Object.keys(workflow.inputs)) {
        availableInputs.add(id);
    }

    workflow.steps.forEach((step, index) => {
        registerId(step.id, ['steps', index, 'id']);
        for (const [id, input] of Object.entries(step.inputs)) {
            registerId(id, ['steps', index, 'inputs', id]);
            if (!availableInputs.has(input.referenceId) && !availableOutputs.has(input.referenceId)) {
                context.addIssue({
                    code: 'custom',
                    path: ['steps', index, 'inputs', id, 'referenceId'],
                    message: 'Reference must target a workflow input or an earlier step output'
                });
            }
        }
        registerFields(step.outputs, ['steps', index, 'outputs']);
        for (const id of Object.keys(step.outputs)) {
            availableOutputs.add(id);
        }
    });

    for (const [id, output] of Object.entries(workflow.outputs)) {
        registerId(id, ['outputs', id]);
        if (!availableOutputs.has(output.referenceId)) {
            context.addIssue({
                code: 'custom',
                path: ['outputs', id, 'referenceId'],
                message: 'Reference must target a step output'
            });
        }
    }
});

export type WorkflowValidationResult =
    | { success: true; data: Workflow }
    | { success: false; issues: z.core.$ZodIssue[] };

export function validateWorkflowSchema(value: unknown): WorkflowValidationResult {
    const result = workflowDefinition.safeParse(value);
    return result.success
        ? { success: true, data: result.data }
        : { success: false, issues: result.error.issues };
}

export type WorkflowValues = Fields<unknown>;

export interface WorkflowExecution {
    workflow: Workflow;
    inputs: WorkflowValues;
    status: 'queued' | 'preparing' | 'ready' | 'running' | 'completed' | 'failed' | 'needs_review';
    results: WorkflowValues | null;
    error: string | null;
}

export interface WorkflowStepProgress {
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    output: WorkflowValues | null;
    error: string | null;
}

export interface WorkflowExecutionStore {
    findJob(jobId: string): Promise<WorkflowExecution | undefined>;
    listJobProgress(jobId: string): Promise<WorkflowStepProgress[]>;
    markJobRunning(jobId: string): Promise<void>;
    // Atomically change pending to running; return false if another execution owns it.
    claimStep(jobId: string, stepId: string): Promise<boolean>;
    completeStep(jobId: string, stepId: string, output: WorkflowValues): Promise<void>;
    failStep(jobId: string, stepId: string, error: string): Promise<void>;
    completeJob(jobId: string, results: WorkflowValues): Promise<void>;
    failJob(jobId: string, error: string): Promise<void>;
}

export interface WorkflowStepHandlers {
    // Inputs and returned outputs are keyed by the step's field IDs.
    // Extraction handlers resolve file inputs from their stored upload metadata.
    extract(step: Extract<Step, { type: 'extract' }>, inputs: WorkflowValues): Promise<WorkflowValues>;
    reason(step: Extract<Step, { type: 'reason' }>, inputs: WorkflowValues): Promise<WorkflowValues>;
}

/** Resume a prepared job and execute its remaining steps in schema order. */
export async function executeNextWorkflowStep(
    jobId: string,
    store: WorkflowExecutionStore,
    handlers: WorkflowStepHandlers
) {
    const job = await store.findJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    if (job.status === 'needs_review') return;
    if (job.status === 'completed') return job.results ?? {};
    if (job.status === 'failed') throw new Error(job.error ?? `Job failed: ${jobId}`);
    if (job.status === 'queued' || job.status === 'preparing') return;

    const progress = new Map((await store.listJobProgress(jobId)).map(step => [step.stepId, step]));
    const values: WorkflowValues = { ...job.inputs };
    let activeStepId: string | undefined;

    const resolveReferences = (references: Fields<FieldReference>): WorkflowValues => Object.fromEntries(
        Object.entries(references).map(([id, reference]) => [id, values[reference.referenceId]])
    );

    try {
        await store.markJobRunning(jobId);

        for (const step of job.workflow.steps) {
            const saved = progress.get(step.id);
            if (saved?.status === 'completed') {
                Object.assign(values, saved.output);
                continue;
            }
            if (saved?.status === 'failed') {
                throw new Error(saved.error ?? `Step failed: ${step.id}`);
            }
            if (!saved) throw new Error(`Step progress not found: ${step.id}`);
            if (saved.status === 'running' || !await store.claimStep(jobId, step.id)) return;

            activeStepId = step.id;
            const inputs = resolveReferences(step.inputs);
            let output: WorkflowValues;

            switch (step.type) {
                case 'extract':
                    output = await handlers.extract(step, inputs);
                    break;
                case 'reason':
                    output = await handlers.reason(step, inputs);
                    break;
                case 'api': {
                    const response: unknown = JSON.parse(step.config.returnValue);
                    output = Object.fromEntries(Object.entries(step.outputs).map(([id, field]) => {
                        let value: unknown = response;
                        for (const attribute of field.source.split('.')) {
                            value = value !== null && typeof value === 'object' && Object.hasOwn(value, attribute)
                                ? (value as Record<string, unknown>)[attribute]
                                : undefined;
                        }
                        if (value === undefined) throw new Error(`API output source not found: ${field.source}`);
                        return [id, value];
                    }));
                    break;
                }
            }

            await store.completeStep(jobId, step.id, output);
            activeStepId = undefined;
            Object.assign(values, output);
        }

        const results = resolveReferences(job.workflow.outputs);
        await store.completeJob(jobId, results);
        return results;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (activeStepId !== undefined) await store.failStep(jobId, activeStepId, message);
        await store.failJob(jobId, message);
        throw error;
    }
}
