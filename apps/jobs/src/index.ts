import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import {
    createDb, findJob, initializeJobProgress, listJobProgress, markJobStatus,
    startJobStep, completeJobStep, failJobStep, completeJob, failJob, reviewJob,
    type Db, type Job, type JobStep
} from '@demo/db';
import { runAgentOne, type InferenceImage } from '@demo/ai';
import type { JobFileInput, SessionWorkflowPayload, Workflow } from '@demo/contracts';
import type { Fields, FieldReference, Step, WorkflowValues } from '@demo/contracts/workflow_schema_module';
import reasoningInstructions from '../../../agents/how_to_reason.md';
import imageExtractionInstructions from '../../../agents/how_to_extract_data_from_images.md';

class AiOutputError extends Error {}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function resolveReferences(references: Fields<FieldReference>, values: WorkflowValues): WorkflowValues {
    return Object.fromEntries(Object.entries(references).map(([id, reference]) => [id, values[reference.referenceId]]));
}

export class SessionWorkflow extends WorkflowEntrypoint<Env, SessionWorkflowPayload> {
    async run(event: WorkflowEvent<SessionWorkflowPayload>, step: WorkflowStep) {
        const { jobId } = event.payload;
        const db = createDb(this.env.DB);
        try {
            const workflow = await step.do('load saved workflow', async () => {
                const job = await findJob(db, jobId);
                if (!job) throw new Error('Job not found');
                await markJobStatus(db, jobId, 'preparing');
                return job.workflow;
            });
            await step.do('initialize step progress', async () => {
                await initializeJobProgress(db, jobId, workflow);
                await markJobStatus(db, jobId, 'running');
            });

            for (const [sequence, definition] of workflow.steps.entries()) {
                // The workflow instance owns execution. A running row can be resumed
                // if the worker was interrupted before this durable operation finished.
                const needsReview = await step.do(`execute step ${sequence + 1}`, { retries: { limit: 0, delay: '1 second' } },
                    async () => {
                        return await doNextJobStep(db, this.env, jobId, definition.id) === null;
                    });
                if (needsReview) return { jobId, status: 'needs_review' };
            }

            const resultsJson = await step.do('complete job', async () => {
                const job = await findJob(db, jobId);
                if (!job) throw new Error('Job not found');
                const values: WorkflowValues = { ...job.inputs };
                for (const saved of await listJobProgress(db, jobId)) {
                    Object.assign(values, saved.output);
                }
                const output = resolveReferences(workflow.outputs, values);
                await completeJob(db, jobId, output);
                return JSON.stringify(output);
            });
            return { jobId, results: JSON.parse(resultsJson) };
        } catch (error) {
            await step.do('fail job', () => failJob(db, jobId, errorMessage(error)));
            throw error;
        }
    }
}

export default { fetch() { return new Response('Jobs worker'); } } satisfies ExportedHandler<Env>;

async function doNextJobStep(db: Db, env: Env, jobId: string, stepId: string) {
    const job = await findJob(db, jobId);
    if (!job) throw new Error('Job not found');
    if (job.status === 'needs_review') return null;
    if (job.status === 'failed') throw new Error(job.error ?? 'Job failed');
    const progress = await listJobProgress(db, jobId);
    const jobStep = progress.find(saved => saved.stepId === stepId);
    if (!jobStep) throw new Error(`Step progress not found: ${stepId}`);
    if (jobStep.status === 'completed') return jobStep.output;
    if (jobStep.status === 'failed') throw new Error(jobStep.error ?? `Step failed: ${stepId}`);
    return executeJobStep(db, env, job, jobStep, progress);
}

async function executeJobStep(db: Db, env: Env, job: Job, jobStep: JobStep, progress: JobStep[]) {
    try {
        await startJobStep(db, jobStep.id);
        const definition = job.workflow.steps.find(step => step.id === jobStep.stepId);
        if (!definition) throw new Error(`Workflow step not found: ${jobStep.stepId}`);
        const values: WorkflowValues = { ...job.inputs };
        for (const saved of progress) {
            if (saved.sequence >= jobStep.sequence) break;
            if (saved.status !== 'completed') throw new Error(`Earlier step is not completed: ${saved.stepId}`);
            Object.assign(values, saved.output);
        }
        const inputs = resolveReferences(definition.inputs, values);
        const output = definition.type === 'api'
            ? executeApiStep(definition)
            : await executeAiStep(env, job.workflow, definition, inputs);
        await completeJobStep(db, jobStep.id, output);
        return output;
    } catch (error) {
        await failJobStep(db, jobStep.id, errorMessage(error));
        if (error instanceof AiOutputError) {
            await reviewJob(db, job.uuid, error.message);
            return null;
        }
        throw error;
    }
}

function executeApiStep(step: Extract<Step, { type: 'api' }>): WorkflowValues {
    const response: unknown = JSON.parse(step.config.returnValue);
    return Object.fromEntries(Object.entries(step.outputs).map(([id, field]) => {
        let value = response;
        for (const attribute of field.source.split('.')) {
            value = value !== null && typeof value === 'object' && Object.hasOwn(value, attribute)
                ? (value as Record<string, unknown>)[attribute]
                : undefined;
        }
        if (value === undefined) throw new Error(`API output source not found: ${field.source}`);
        return [id, value];
    }));
}

async function executeAiStep(
    env: Env,
    workflow: Workflow,
    step: Exclude<Step, { type: 'api' }>,
    inputs: WorkflowValues
): Promise<WorkflowValues> {
    const images: InferenceImage[] = [];
    const imageAttachments: { inputId: string; imageIndex: number }[] = [];
    const inputFields = new Map(Object.entries(workflow.inputs));
    for (const earlier of workflow.steps) {
        if (earlier.id === step.id) break;
        for (const [id, field] of Object.entries(earlier.outputs)) inputFields.set(id, field);
    }
    for (const [id, reference] of Object.entries(step.inputs)) {
        if (inputFields.get(reference.referenceId)?.type !== 'file') continue;
        const file = inputs[id] as JobFileInput | null | undefined;
        if (file == null) continue;
        if (file.contentType !== 'image/jpeg' && file.contentType !== 'image/png') {
            throw new Error(`Unsupported file type for ${file.filename}: ${file.contentType}. Use JPEG or PNG.`);
        }
        const object = await env.JOB_UPLOADS.get(file.key);
        if (!object) throw new Error(`Uploaded file not found: ${file.filename}`);
        imageAttachments.push({ inputId: id, imageIndex: images.length });
        images.push({ bytes: new Uint8Array(await object.arrayBuffer()), mimeType: file.contentType });
    }
    const schema = JSON.stringify(step.outputs);
    const instructions = step.config.instructions;
    const inputData = JSON.stringify({
        fields: Object.fromEntries(Object.entries(step.inputs).map(([id, reference]) => [
            id,
            { ...inputFields.get(reference.referenceId), value: inputs[id] }
        ])),
        imageAttachments
    });
    const contents = [schema, instructions, inputData];
    const keys = new Set<string>();
    const createDelimiterKey = () => {
        let key: string;
        do {
            key = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        } while (keys.has(key) || contents.some(content => content.includes(key)));
        keys.add(key);
        return key;
    };
    const schemaKey = createDelimiterKey();
    const instructionsKey = createDelimiterKey();
    const inputDataKey = createDelimiterKey();
    const prompt = [
        `schema-${schemaKey}`,
        schema,
        `schema-${schemaKey}`,
        `INSTRUCTIONS-${instructionsKey}`,
        instructions,
        `INSTRUCTIONS-${instructionsKey}`,
        `INPUT_DATA-${inputDataKey}`,
        inputData,
        `INPUT_DATA-${inputDataKey}`
    ].join('\n')

    const result: unknown = await runAgentOne(env, {
        systemInstructions: images.length > 0 ? imageExtractionInstructions : reasoningInstructions,
        prompt,
        images
    });

    const response = (result as { response?: unknown } | null)?.response;
    const json = extractJSON(response);
    if (json === null || typeof json !== 'object' || Array.isArray(json)) {
        throw new AiOutputError('AI response must contain an output object');
    }
    if (Object.keys(json).some(id => !Object.hasOwn(step.outputs, id))) {
        throw new AiOutputError('AI response contains undeclared output fields');
    }
    for (const [id, field] of Object.entries(step.outputs)) {
        const value = (json as WorkflowValues)[id];
        if (!Object.hasOwn(json, id) || value == null) {
            throw new AiOutputError(`AI output is missing: ${field.name} (${id})`);
        }
        const validType = field.type === 'file'
            ? isFileValue(value)
            : typeof value === field.type && (field.type !== 'number' || Number.isFinite(value));
        if (!validType || ('enum' in field && field.enum && !field.enum.some(allowed => allowed === value))) {
            throw new AiOutputError(`AI output does not match the schema: ${field.name} (${id})`);
        }
    }
    // Persist only declared outputs so model-added fields cannot override references.
    return Object.fromEntries(Object.keys(step.outputs).map(id => [id, (json as WorkflowValues)[id]]));
}

function isFileValue(value: unknown): value is JobFileInput {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const file = value as Partial<JobFileInput>;
    return typeof file.key === 'string' && file.key.length > 0
        && typeof file.filename === 'string' && file.filename.length > 0
        && typeof file.contentType === 'string' && file.contentType.length > 0
        && typeof file.size === 'number' && Number.isFinite(file.size) && file.size >= 0;
}

function extractJSON(response: unknown): unknown {
    if (typeof response !== 'string') return response;
    const json = response.match(/```json\s*([\s\S]*?)```/)?.[1] ?? response;
    try {
        return JSON.parse(json);
    } catch {
        return undefined;
    }
}
