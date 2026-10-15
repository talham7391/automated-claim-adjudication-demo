import { runAgentOne } from '@demo/ai';

export default defineEventHandler(async event => {
    const res = await runAgentOne(bindings(event), {
        prompt: 'Reply with a short greeting to confirm this test works.',
        systemInstructions: 'You are a test assistant. Keep your response to one sentence.'
    });

    if (typeof res.response !== 'string') {
        throw createError({ statusCode: 502 });
    }

    return res.response;
});
