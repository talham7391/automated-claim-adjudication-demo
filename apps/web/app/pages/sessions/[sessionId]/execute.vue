<script setup lang="ts">
import Button from 'primevue/button';
import type { JobDetail, JobSummary } from '@demo/db';

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
const { data: jobs, refresh: refreshJobs, error: historyError } = await useFetch<JobSummary[]>(jobsUrl);
const selectedJobId = ref<string | null>(null);
const selectedJob = ref<JobDetail | null>(null);
const submitting = ref(false);
const submissionError = ref('');
const detailError = ref('');
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

function statusLabel(status: string) {
    return status === 'ready' ? 'Ready — step execution is not implemented yet' : status;
}

async function loadSelectedJob() {
    const id = selectedJobId.value;
    if (!id) return;
    try {
        const job = await $fetch<JobDetail>(`${jobsUrl}/${id}`);
        if (!disposed && selectedJobId.value === id) {
            selectedJob.value = job;
            detailError.value = '';
        }
    } catch {
        if (!disposed && selectedJobId.value === id) detailError.value = 'Unable to load job details.';
    }
}

async function selectJob(id: string) {
    selectedJobId.value = id;
    selectedJob.value = null;
    detailError.value = '';
    await loadSelectedJob();
}

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
        const job = await $fetch<{ id: string }>(jobsUrl, { method: 'POST', body: form, retry: 0 });
        await refreshJobs();
        await selectJob(job.id);
    } catch (error: any) {
        submissionError.value = error.data?.statusMessage ?? 'Unable to submit job.';
        const jobId = error.data?.data?.jobId;
        await refreshJobs();
        if (jobId) await selectJob(jobId);
    } finally {
        submitting.value = false;
    }
}

function schedulePoll() {
    pollTimer = setTimeout(async () => {
        if (disposed) return;
        if (historyError.value || jobs.value?.some(job => ['queued', 'preparing', 'running'].includes(job.status))) {
            await refreshJobs();
        }
        if (selectedJobId.value && (!selectedJob.value || ['queued', 'preparing', 'running'].includes(selectedJob.value.status))) {
            await loadSelectedJob();
        }
        if (!disposed) schedulePoll();
    }, 2000);
}

onMounted(schedulePoll);
onBeforeUnmount(() => {
    disposed = true;
    clearTimeout(pollTimer);
});
</script>

<template>
    <BasePage>
        <h1>Execute workflow</h1>
        <p>Session UUID: {{ session?.uuid }}</p>
        <section v-if="workflow" class="execution-panel" aria-labelledby="saved-workflow-title">
            <h2 id="saved-workflow-title">Saved workflow</h2>
            <p>{{ workflow.description }}</p>
            <form class="workflow-inputs" @submit.prevent="submitJob">
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
                        <input v-else-if="field.type === 'file'" :id="`input-${id}`" type="file" :aria-describedby="`description-${id}`" @change="selectFile(id, $event)" />
                        <input v-else-if="field.type === 'number'" :id="`input-${id}`" v-model.number="inputValues[id]" type="number" step="any" :aria-describedby="`description-${id}`" />
                        <input v-else :id="`input-${id}`" v-model="inputValues[id]" type="text" :aria-describedby="`description-${id}`" />
                    </div>
                    <p id="execution-status">Submissions save your inputs and prepare a background job. Step execution is not implemented yet.</p>
                    <p v-if="submissionError" role="alert">{{ submissionError }}</p>
                    <Button type="submit" label="Prepare workflow job" :loading="submitting" :disabled="submitting" aria-describedby="execution-status" />
                </fieldset>
            </form>
        </section>
        <p v-else class="mt-6">
            No workflow saved yet.
            <NuxtLink :to="`/sessions/${route.params.sessionId}`">Edit workflow</NuxtLink> to generate one.
        </p>
        <section class="execution-panel" aria-labelledby="job-history-title">
            <h2 id="job-history-title">Job history</h2>
            <p v-if="historyError" role="alert">Unable to load job history.</p>
            <p v-else-if="!jobs?.length">No jobs submitted yet.</p>
            <ul v-else class="job-history">
                <li v-for="job in jobs" :key="job.id">
                    <button type="button" :aria-pressed="selectedJobId === job.id" @click="selectJob(job.id)">
                        {{ job.description }} — {{ statusLabel(job.status) }}
                        <span>{{ new Date(job.createdAt).toISOString() }} · {{ job.id }}</span>
                    </button>
                </li>
            </ul>
        </section>
        <section v-if="selectedJobId" class="execution-panel" aria-labelledby="job-details-title" aria-live="polite">
            <h2 id="job-details-title">Job details</h2>
            <p v-if="detailError" role="alert">{{ detailError }}</p>
            <template v-else-if="selectedJob">
                <p>{{ selectedJob.id }}</p>
                <p>{{ statusLabel(selectedJob.status) }}</p>
                <p v-if="selectedJob.error" role="alert">{{ selectedJob.error }}</p>
                <h3>Saved workflow</h3>
                <p>{{ selectedJob.workflow.description }}</p>
                <ol class="job-history">
                    <li v-for="step in selectedJob.workflow.steps" :key="step.id">
                        <strong>{{ step.name }}</strong> — {{ selectedJob.progress.find(progress => progress.stepId === step.id)?.status ?? 'pending' }}
                        <p>{{ step.description }}</p>
                        <p v-if="selectedJob.progress.find(progress => progress.stepId === step.id)?.error" role="alert">
                            {{ selectedJob.progress.find(progress => progress.stepId === step.id)?.error }}
                        </p>
                    </li>
                </ol>
                <details>
                    <summary>Submitted inputs and workflow snapshot</summary>
                    <pre>{{ JSON.stringify({ inputs: selectedJob.inputs, workflow: selectedJob.workflow }, null, 4) }}</pre>
                </details>
            </template>
            <p v-else>Loading job details…</p>
        </section>
    </BasePage>
</template>

<style scoped>
.execution-panel {
    max-width: 720px;
    margin-top: 24px;
    padding: 20px;
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
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #fff;
}
fieldset.workflow-inputs {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
}

.job-history {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 16px 0;
}

.job-history button {
    text-align: left;
    color: #1d4ed8;
    cursor: pointer;
}

.job-history button[aria-pressed='true'] {
    font-weight: 650;
}

.job-history span {
    display: block;
    color: #475569;
    font-size: 12px;
    overflow-wrap: anywhere;
}

pre {
    margin-top: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}
</style>
