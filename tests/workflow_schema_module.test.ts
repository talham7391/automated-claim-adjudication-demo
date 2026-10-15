import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkflowSchema, type Workflow } from '../packages/contracts/src/workflow_schema_module';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const field = { name: 'Value', description: '', type: 'string' as const };
const reference = (referenceId: string) => ({ name: 'Value', description: '', referenceId });

function validWorkflow(): Workflow {
    return {
        _schemaVersion: '0.0.1',
        revision: 1,
        name: 'Claim review',
        description: '',
        inputs: { [id(1)]: { ...field, type: 'file' } },
        steps: [
            {
                id: id(2), name: 'Extract', description: '', type: 'extract',
                config: { modelProfile: 'default', instructions: 'Extract claim details' },
                inputs: { [id(3)]: reference(id(1)) },
                outputs: { [id(4)]: field }
            },
            {
                id: id(8), name: 'Reason', description: '', type: 'reason',
                config: { modelProfile: 'default', instructions: 'Review claim details' },
                inputs: { [id(9)]: reference(id(4)) },
                outputs: { [id(10)]: { ...field, type: 'boolean' } }
            },
            {
                id: id(11), name: 'Submit', description: '', type: 'api',
                config: { integration: 'claims', operation: 'submit', operationVersion: 1, connectionId: 'claims' },
                inputs: { [id(12)]: reference(id(10)) },
                outputs: { [id(13)]: { ...field, source: 'result.claim.id' } }
            }
        ],
        outputs: { [id(14)]: reference(id(13)) }
    };
}

test('accepts a valid workflow with every step type and valid references', () => {
    const workflow = validWorkflow();
    const result = validateWorkflowSchema(workflow);

    assert.equal(result.success, true);
    if (result.success) {
        assert.deepEqual(result.data, workflow);
    }
});

test('rejects references to missing, current, later, or disallowed fields', () => {
    const cases = [
        { name: 'missing step input target', target: id(99), workflowOutput: false },
        { name: 'current step output', target: id(4), workflowOutput: false },
        { name: 'later step output', target: id(10), workflowOutput: false },
        { name: 'missing workflow output target', target: id(99), workflowOutput: true },
        { name: 'workflow input used as workflow output', target: id(1), workflowOutput: true }
    ];

    for (const scenario of cases) {
        const workflow = validWorkflow();
        const path = scenario.workflowOutput
            ? ['outputs', id(14), 'referenceId']
            : ['steps', 0, 'inputs', id(3), 'referenceId'];
        const input = scenario.workflowOutput ? workflow.outputs[id(14)] : workflow.steps[0].inputs[id(3)];
        input.referenceId = scenario.target;

        const result = validateWorkflowSchema(workflow);
        assert.equal(result.success, false, scenario.name);
        if (!result.success) {
            assert.deepEqual(result.issues.map(issue => ({ code: issue.code, path: issue.path, message: issue.message })), [{
                code: 'custom',
                path,
                message: scenario.workflowOutput
                    ? 'Reference must target a step output'
                    : 'Reference must target a workflow input or an earlier step output'
            }], scenario.name);
        }
    }
});

test('rejects duplicate UUIDs across steps, inputs, and outputs', () => {
    const cases: { name: string; mutate: (workflow: Workflow) => void; path: (string | number)[] }[] = [
        {
            name: 'duplicate step IDs',
            mutate: workflow => { workflow.steps[1].id = workflow.steps[0].id; },
            path: ['steps', 1, 'id']
        },
        {
            name: 'workflow input and step output share an ID',
            mutate: workflow => { workflow.steps[0].outputs[id(1)] = field; },
            path: ['steps', 0, 'outputs', id(1)]
        },
        {
            name: 'step input and workflow output share an ID',
            mutate: workflow => { workflow.outputs[id(3)] = reference(id(13)); },
            path: ['outputs', id(3)]
        }
    ];

    for (const scenario of cases) {
        const workflow = validWorkflow();
        scenario.mutate(workflow);
        const result = validateWorkflowSchema(workflow);

        assert.equal(result.success, false, scenario.name);
        if (!result.success) {
            assert.deepEqual(result.issues.map(issue => ({ code: issue.code, path: issue.path, message: issue.message })), [{
                code: 'custom', path: scenario.path, message: 'UUID must be unique throughout the workflow'
            }], scenario.name);
        }
    }
});
