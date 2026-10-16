<script setup lang="ts">
definePageMeta({ key: route => route.path });

const route = useRoute();
const workflow = computed(() => session.value?.workflow ?? null);

const modificationText = ref('');
const modifyPending = ref(false);
const modifyError = ref('');
const modifySuccess = ref('');
const { data: session, error } = await useFetch(() => `/api/sessions/${route.params.sessionId}`);

if (error.value) {
    throw createError({
        statusCode: error.value.statusCode ?? 500,
        statusMessage: error.value.statusCode === 404 ? 'Session not found' : 'Unable to load session',
        fatal: true
    });
}

async function modifyWorkflow() {
    if (modifyPending.value) return;

    modifyPending.value = true;
    modifyError.value = '';
    modifySuccess.value = '';
    try {
        const result = await $fetch('/api/workflows/modify', {
            method: 'POST',
            body: {
                text: modificationText.value,
                session: { uuid: session.value!.uuid }
            }
        });
        session.value = { ...session.value!, workflow: result.workflow };
        modificationText.value = '';
        modifySuccess.value = 'Workflow updated.';
    } catch {
        modifyError.value = 'Unable to modify workflow. Please try again.';
    } finally {
        modifyPending.value = false;
    }
}
</script>

<template>
    <BasePage class="editor-page">
        <header class="editor-hero">
            <p class="eyebrow">Build your process</p>
            <h1>Describe your <span>workflow.</span></h1>
            <p class="editor-description">Describe your claim adjudication process in plain language. Refine the steps, then explore how information flows through your workflow.</p>
            <p class="session-reference">Session <span>{{ session?.uuid }}</span></p>
        </header>
        <form class="prompt-form" :aria-busy="modifyPending" @submit.prevent="modifyWorkflow">
            <fieldset :disabled="modifyPending">
                <label for="workflow-modifications">Describe your workflow or requested changes</label>
                <div class="prompt-controls">
                    <input
                        id="workflow-modifications"
                        v-model="modificationText"
                        type="text"
                        placeholder="e.g. Extract prescription details, then check coverage"
                        autocomplete="off"
                        :disabled="modifyPending"
                        aria-describedby="prompt-hint"
                    />
                    <button type="submit" class="submit-button" :disabled="modifyPending">
                        {{ modifyPending ? 'Updating…' : 'Update workflow' }}
                        <span v-if="!modifyPending" aria-hidden="true">→</span>
                    </button>
                </div>
                <p id="prompt-hint" class="prompt-hint">Press Enter to apply your prompt.</p>
            </fieldset>
            <p v-if="modifyPending" class="request-status" role="status">Updating your workflow. This may take a moment.</p>
            <p v-if="modifySuccess" class="success-message" role="status">{{ modifySuccess }}</p>
            <p v-if="modifyError" class="error-message" role="alert">{{ modifyError }}</p>
        </form>
        <WorkflowVisualization v-if="workflow" :workflow="workflow">
            <template #actions>
                <div class="workflow-actions">
                    <p>Ready to try your workflow? Provide inputs and follow an execution.</p>
                    <NuxtLink :to="`/sessions/${route.params.sessionId}/execute`" class="execute-link">
                        Execute workflow <span aria-hidden="true">→</span>
                    </NuxtLink>
                </div>
            </template>
        </WorkflowVisualization>
        <section v-else class="empty-workflow">
            <h2>Your workflow starts here</h2>
            <p>Describe your process above to generate its steps and connections.</p>
        </section>
    </BasePage>
</template>

<style scoped>
.editor-page {
    max-width: 1120px;
    margin: 0 auto;
    padding: 24px 28px 56px;
    color: #0f172a;
}

.editor-hero {
    padding: 20px 0 32px;
}

.eyebrow {
    margin: 0 0 16px;
    color: #0f766e;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

h1 {
    margin: 0;
    font-size: clamp(36px, 5vw, 60px);
    font-weight: 650;
    letter-spacing: -0.045em;
    line-height: 1.12;
}

h1 span {
    color: #0f766e;
}

.editor-description {
    max-width: 680px;
    margin: 20px 0;
    color: #475569;
    font-size: 16px;
    line-height: 1.8;
}

.session-reference {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    color: #64748b;
    font-size: 12px;
    overflow-wrap: anywhere;
}

.prompt-form {
    padding: 24px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
}

.prompt-form fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
}

.prompt-form label {
    display: block;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
}

.prompt-controls {
    display: flex;
    gap: 12px;
}

.prompt-controls input {
    flex: 1;
    min-width: 0;
    min-height: 46px;
    padding: 12px 14px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-size: 14px;
}

.prompt-controls input::placeholder {
    color: #64748b;
}

.submit-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 46px;
    padding: 12px 20px;
    border: 1px solid #0f766e;
    border-radius: 8px;
    background: #0f766e;
    color: #fff;
    font-size: 14px;
    font-weight: 650;
    cursor: pointer;
}

.submit-button:hover:not(:disabled) {
    background: #115e59;
}

.prompt-controls :disabled {
    opacity: 0.65;
    cursor: wait;
}

.editor-page :is(a, button, input):focus-visible {
    outline: 2px solid #0f766e;
    outline-offset: 3px;
}

.prompt-hint,
.request-status,
.success-message,
.error-message {
    margin: 12px 0 0;
    font-size: 13px;
    line-height: 1.6;
}

.prompt-hint,
.request-status {
    color: #64748b;
}

.success-message {
    color: #0f766e;
}

.error-message {
    color: #b91c1c;
}

.empty-workflow {
    margin-top: 32px;
    padding: 40px 24px;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    background: #f8fafc;
    text-align: center;
}

.empty-workflow h2 {
    margin: 0 0 12px;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.025em;
}

.empty-workflow p {
    margin: 0;
    color: #64748b;
    font-size: 14px;
}

@media (max-width: 720px) {
    .editor-page {
        padding: 16px 20px 40px;
    }

    .prompt-form {
        padding: 20px;
    }

    .prompt-controls {
        flex-direction: column;
    }
}

.workflow-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e2e8f0;
}

.execute-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 46px;
    padding: 12px 20px;
    border: 1px solid #0f766e;
    border-radius: 8px;
    background: #0f766e;
    color: #fff;
    font-size: 14px;
    font-weight: 650;
    text-decoration: none;
}

.execute-link:hover {
    background: #115e59;
}

</style>
