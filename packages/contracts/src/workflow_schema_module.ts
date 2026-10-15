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

export interface FieldReference extends NamedField {
    // ID of a workflow input or an earlier step's output.
    // Workflow outputs reference step outputs.
    referenceId: string;
}

export type ApiOutput = FieldDefinition & {
    // Dot-separated attribute path within the JSON response body.
    source: string;
};

export interface AiConfig {
    modelProfile: string;
    instructions: string;
}

export interface ApiConfig {
    integration: string;
    operation: string;
    connectionId: string;
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
        config: AiConfig;
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
    revision: number;
    name: string;
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

const fieldReference = z.object({ ...namedField, referenceId: id });
const apiOutput = z.intersection(fieldDefinition, z.object({
    source: z.string().regex(/^[^.\s/]+(?:\.[^.\s/]+)*$/, 'Use a dot-separated JSON attribute path')
}));
const aiConfig = z.object({
    modelProfile: z.string().trim().min(1),
    instructions: z.string().trim().min(1)
});
const stepBase = {
    id: id,
    ...namedField,
    inputs: z.record(id, fieldReference)
};
const stepDefinition = z.discriminatedUnion('type', [
    z.object({ ...stepBase, type: z.literal('extract'), config: aiConfig, outputs: z.record(id, fieldDefinition) }),
    z.object({ ...stepBase, type: z.literal('reason'), config: aiConfig, outputs: z.record(id, fieldDefinition) }),
    z.object({
        ...stepBase,
        type: z.literal('api'),
        config: z.object({
            integration: z.string().trim().min(1),
            operation: z.string().trim().min(1),
            connectionId: z.string().trim().min(1)
        }),
        outputs: z.record(id, apiOutput)
    })
]);

const workflowDefinition = z.object({
    _schemaVersion: z.literal('0.0.1'),
    revision: z.number().int().positive(),
    ...namedField,
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
