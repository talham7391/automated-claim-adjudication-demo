import { runAgentOne } from '@demo/ai';
import type { Workflow } from '@demo/contracts';
import { validateWorkflowSchema } from '@demo/contracts/workflow_schema_module';
import { createDb, findSession, saveSessionWorkflow } from '@demo/db';
import systemInstructions from 'virtual:workflow-instructions';

interface ModifyWorkflowBody {
    text: string;
    session: {
        uuid: string;
    };
}

function createDelimiterKey(schema: string, text: string, previousKey?: string): string {
    let key: string;
    do {
        key = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    } while (schema.includes(key) || text.includes(key) || key === previousKey);
    return key;
}

export default defineEventHandler(async event => {
    const { text, session: inputSession } = await readBody<ModifyWorkflowBody>(event);
    const db = createDb(bindings(event).DB);
    const session = await findSession(db, inputSession.uuid);
    if (!session) {
        throw createError({ statusCode: 404, statusMessage: 'Session not found' });
    }
    const schema = JSON.stringify(session.workflow);
    const schemaKey = createDelimiterKey(schema, text);
    const modificationsKey = createDelimiterKey(schema, text, schemaKey);
    const result = await runAgentOne(bindings(event), {
        systemInstructions,
        prompt: [
            `schema-${schemaKey}`,
            schema,
            `schema-${schemaKey}`,
            `modificaitons-${modificationsKey}`,
            text,
            `modificaitons-${modificationsKey}`
        ].join('\n')
    });
    const workflow = getNewSchema(session.workflow, result);
    if (workflow !== null && workflow !== session.workflow) {
        await saveSessionWorkflow(db, session.uuid, workflow);
    }
    return { workflow };
});

function getNewSchema(schema: Workflow | null, result: any): Workflow | null {
    if (typeof result.response !== 'string') {
        return schema
    }

    else if (!result.choices.some((x: any) => x.finish_reason === "stop")) {
        return schema
    }

    let json = result.response.split("```json")[1]

    if (!json) {
        return schema
    }

    json = json.split("```").slice(-2)[0]

    if (!json) {
        return schema
    }

    let newSchema = {}

    try {
        newSchema = JSON.parse(json)
    } catch(error) {
        return schema
    }

    const res = validateWorkflowSchema(newSchema)
    if (res.success) {
        return res.data
    } else {
        console.log(res.issues)
    }

    return schema
}
