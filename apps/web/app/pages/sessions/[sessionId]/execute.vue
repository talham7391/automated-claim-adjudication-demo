<script setup lang="ts">

definePageMeta({ key: route => route.path });

const route = useRoute();
const { data: session, error } = await useFetch(() => `/api/sessions/${route.params.sessionId}`);

if (error.value) {
    throw createError({
        statusCode: error.value.statusCode ?? 500,
        statusMessage: error.value.statusCode === 404 ? 'Session not found' : 'Unable to load session',
        fatal: true
    });
}

const workflow = computed(() => session.value?.workflow ?? null);
const inputValues = ref<Record<string, string | number | boolean | File | null>>({});

watch(workflow, value => {
    inputValues.value = Object.fromEntries(
        Object.entries(value?.inputs ?? {}).map(([id, field]) => [
            id,
            field.type === 'boolean' ? false : null
        ])
    );
}, { immediate: true });

function selectFile(id: string, event: Event) {
    inputValues.value[id] = (event.target as HTMLInputElement).files?.[0] ?? null;
}

const jobsUrl = `/api/sessions/${route.params.sessionId}/jobs`;
const submitting = ref(false);
const submissionError = ref('');

async function submitJob() {
    if (submitting.value) return;
    submitting.value = true;
    submissionError.value = '';
    try {
        const form = new FormData();
        const scalarInputs: Record<string, string | number | boolean | null> = {};
        for (const [id, value] of Object.entries(inputValues.value)) {
            if (value instanceof File) form.append(id, value);
            else scalarInputs[id] = value;
        }
        form.append('inputs', JSON.stringify(scalarInputs));
        const job = await $fetch<{ uuid: string }>(jobsUrl, { method: 'POST', body: form, retry: 0 });
        await navigateTo(`/sessions/${route.params.sessionId}/executions/${job.uuid}`);
    } catch (error: any) {
        submissionError.value = error.data?.statusMessage ?? 'Unable to submit job.';
        const jobId = error.data?.data?.jobId;
        if (jobId) {
            await navigateTo(`/sessions/${route.params.sessionId}/executions/${jobId}`);
        }
    } finally {
        submitting.value = false;
    }
}

</script>

<template>
    <BasePage class="execute-page">
        <header class="execute-hero">
            <p class="eyebrow">Put your process to work</p>
            <h1>Execute your <span>workflow.</span></h1>
            <p class="hero-description">Provide the inputs for your saved workflow, start an execution, and view progress on the execution detail page.</p>
            <p class="session-reference">Session <span>{{ session?.uuid }}</span></p>
        </header>
        <section v-if="workflow" class="execution-panel" aria-labelledby="saved-workflow-title">
            <h2 id="saved-workflow-title">Saved workflow</h2>
            <p>{{ workflow.description }}</p>
            <form class="workflow-inputs" :aria-busy="submitting" @submit.prevent="submitJob">
                <fieldset :disabled="submitting" class="workflow-inputs">
                    <h3>Workflow inputs</h3>
                    <p v-if="!Object.keys(workflow.inputs).length">This workflow has no inputs.</p>
                    <div v-for="(field, id) in workflow.inputs" :key="id" class="workflow-field">
                        <label :for="`input-${id}`">{{ field.name }}</label>
                        <p :id="`description-${id}`" class="field-description">{{ field.description }}</p>
                        <select v-if="'enum' in field && field.enum" :id="`input-${id}`" v-model="inputValues[id]" :aria-describedby="`description-${id}`">
                            <option :value="null" disabled>Select a value</option>
                            <option v-for="option in field.enum" :key="option" :value="option">{{ option }}</option>
                        </select>
                        <input v-else-if="field.type === 'boolean'" :id="`input-${id}`" v-model="inputValues[id]" type="checkbox" :aria-describedby="`description-${id}`" />
                        <input v-else-if="field.type === 'file'" :id="`input-${id}`" type="file" accept="image/jpeg,image/png" :aria-describedby="`description-${id}`" @change="selectFile(id, $event)" />
                        <input v-else-if="field.type === 'number'" :id="`input-${id}`" v-model.number="inputValues[id]" type="number" step="any" :aria-describedby="`description-${id}`" />
                        <input v-else :id="`input-${id}`" v-model="inputValues[id]" type="text" :aria-describedby="`description-${id}`" />
                    </div>
                    <p id="execution-status">Submissions save your inputs and execute the workflow in the background. File inputs support JPEG and PNG images.</p>
                    <p v-if="submissionError" role="alert">{{ submissionError }}</p>
                    <div class="submit-actions">
                        <button type="submit" class="primary-button" :disabled="submitting" aria-describedby="execution-status">
                            {{ submitting ? 'Starting execution…' : 'Execute workflow' }}
                            <span v-if="!submitting" aria-hidden="true">→</span>
                        </button>
                        <p v-if="submitting" role="status">Starting your workflow and opening its progress…</p>
                    </div>
                </fieldset>
            </form>
        </section>
        <section v-else class="empty-state">
            <h2>Create a workflow first</h2>
            <p>Describe your process to generate the steps you want to execute.</p>
            <NuxtLink :to="`/sessions/${route.params.sessionId}`" class="primary-button">Describe your workflow <span aria-hidden="true">→</span></NuxtLink>
        </section>
    </BasePage>
</template>

<style scoped>
.execute-page {
    max-width: 1120px;
    margin: 0 auto;
    padding: 24px 28px 56px;
    color: #0f172a;
}

.execute-hero {
    padding: 20px 0 8px;
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

.hero-description {
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

.execution-panel > p:not(.eyebrow),
.empty-state p {
    color: #475569;
    font-size: 14px;
    line-height: 1.8;
}

.execution-panel h2,
.empty-state h2 {
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.025em;
}

.primary-button {
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
    cursor: pointer;
}

.primary-button:hover:not(:disabled) {
    background: #115e59;
}

.workflow-inputs :disabled {
    opacity: 0.65;
    cursor: wait;
}

.execute-page :is(a, button, input, select, summary):focus-visible {
    outline: 2px solid #0f766e;
    outline-offset: 3px;
}

.submit-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    padding-top: 8px;
}

.submit-actions p {
    color: #64748b;
    font-size: 13px;
}

.empty-state {
    margin-top: 24px;
    padding: 32px 24px;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    background: #f8fafc;
    text-align: center;
}

.empty-state p {
    margin: 12px 0 20px;
}


.workflow-field input[type='checkbox'] {
    width: 18px;
    height: 18px;
    accent-color: #0f766e;
}

.workflow-field input::file-selector-button {
    margin-right: 12px;
    padding: 6px 12px;
    border: 0;
    border-radius: 6px;
    background: #f0fdfa;
    color: #0f766e;
    font: inherit;
    cursor: pointer;
}

.execution-panel [role='alert'] {
    color: #b91c1c;
}



@media (max-width: 720px) {
    .execute-page {
        padding: 16px 20px 40px;
    }

    .execution-panel {
        padding: 20px;
    }

    .submit-actions,
    .primary-button {
        width: 100%;
    }
}

.execution-panel {
    min-width: 0;
    margin-top: 24px;
    padding: 28px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    color: #0f172a;
}

.execution-panel h2,
.execution-panel h3 {
    font-weight: 650;
    margin-bottom: 8px;
}

.workflow-inputs {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 24px;
}

.workflow-field {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
}

.workflow-field label {
    font-weight: 600;
}

.field-description,
#execution-status {
    color: #475569;
    font-size: 14px;
}

.workflow-field input:not([type='checkbox']),
.workflow-field select {
    width: 100%;
    min-width: 0;
    min-height: 46px;
    padding: 12px 14px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #fff;
}
fieldset.workflow-inputs {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
}







</style>
