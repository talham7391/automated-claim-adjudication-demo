export interface InferenceImage {
    bytes: Uint8Array;
    mimeType: 'image/jpeg' | 'image/png';
}

export interface InferenceInput {
    prompt: string;
    systemInstructions?: string;
    images?: InferenceImage[];
}

export interface InferenceEnv {
    AI: Ai;
    AGENT_ONE_MODEL: string;
    AGENT_TWO_MODEL: string;
}

type Message = {
    role: 'system' | 'user';
    content: string | (
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
    )[];
};

function imageDataUrl(image: InferenceImage): string {
    // Encode in chunks to avoid exceeding the argument limit for large images.
    let binary = '';
    for (let offset = 0; offset < image.bytes.length; offset += 8192) {
        binary += String.fromCharCode(...image.bytes.subarray(offset, offset + 8192));
    }
    return `data:${image.mimeType};base64,${btoa(binary)}`;
}

function runInference(env: InferenceEnv, model: string, input: InferenceInput) {
    const messages: Message[] = [];
    if (input.systemInstructions !== undefined) {
        messages.push({ role: 'system', content: input.systemInstructions });
    }

    messages.push({
        role: 'user',
        content: input.images?.length
            ? [
                { type: 'text', text: input.prompt },
                ...input.images.map(image => ({
                    type: 'image_url' as const,
                    image_url: { url: imageDataUrl(image) }
                }))
            ]
            : input.prompt
    });

    return env.AI.run(model, { messages, stream: false, max_tokens: 1024 });
}

export function runAgentOne(env: InferenceEnv, input: InferenceInput) {
    return runInference(env, env.AGENT_ONE_MODEL, input);
}

export function runAgentTwo(env: InferenceEnv, input: InferenceInput) {
    return runInference(env, env.AGENT_TWO_MODEL, input);
}
