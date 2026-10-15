<script setup lang="ts">
import type { JobDetail } from '@demo/db';
import Button from 'primevue/button';

definePageMeta({ key: route => route.path });

const route = useRoute();
const sessionPath = `/sessions/${route.params.sessionId}`;
const { data: job, error, status, refresh } = await useFetch<JobDetail>(`/api${sessionPath}/jobs/${route.params.jobId}`);

if (error.value?.statusCode === 404) {
    throw createError({ statusCode: 404, statusMessage: 'Execution not found', fatal: true });
}

const steps = computed(() => job.value?.workflow.steps.map(step => ({
    ...step,
    progress: job.value?.progress.find(progress => progress.stepId === step.id)
})) ?? []);
const timestamps = computed(() => job.value ? [
    { label: 'Created', value: job.value.createdAt },
    { label: 'Updated', value: job.value.updatedAt },
    { label: 'Started', value: job.value.startedAt },
    { label: 'Completed', value: job.value.completedAt }
] : []);

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

function schedulePoll() {
    pollTimer = setTimeout(async () => {
        if (disposed) return;
        if (error.value || (job.value && ['queued', 'preparing', 'running'].includes(job.value.status))) {
            await refresh();
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
        <NuxtLink :to="`${sessionPath}/executions`" class="text-blue-700 underline">Back to executions</NuxtLink>
        <h1 class="mt-4 text-2xl font-bold">Execution detail</h1>
        <p class="mt-2 text-sm text-slate-600 break-all">Execution ID: {{ route.params.jobId }}</p>
        <div v-if="error" class="execution-panel" role="alert">
            <p>Unable to load execution details.</p>
            <Button class="mt-3" label="Retry" :loading="status === 'pending'" @click="refresh()" />
        </div>
        <p v-else-if="!job" class="mt-6">Loading execution details…</p>
        <template v-if="job">
            <section class="execution-panel" aria-labelledby="execution-status-title" aria-live="polite">
                <h2 id="execution-status-title">Status: {{ job.status }}</h2>
                <p v-if="job.status === 'ready'" class="mt-2 text-sm text-slate-600">Preparation completed; step execution is not implemented yet.</p>
                <p v-if="job.error" class="mt-2 text-red-700" role="alert">{{ job.error }}</p>
                <dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div v-for="timestamp in timestamps" :key="timestamp.label">
                        <dt class="text-sm text-slate-600">{{ timestamp.label }}</dt>
                        <dd class="text-sm">
                            <time v-if="timestamp.value != null" :datetime="new Date(timestamp.value).toISOString()">{{ new Date(timestamp.value).toISOString() }}</time>
                            <span v-else>—</span>
                        </dd>
                    </div>
                </dl>
            </section>
            <section class="execution-panel" aria-labelledby="saved-workflow-title">
                <h2 id="saved-workflow-title">Saved workflow</h2>
                <p class="mt-2">{{ job.workflow.description }}</p>
                <h3 class="mt-5 font-semibold">Step progress</h3>
                <p v-if="!steps.length" class="mt-2 text-sm text-slate-600">This workflow has no steps.</p>
                <ol v-else class="mt-3 flex flex-col gap-3">
                    <li v-for="(step, index) in steps" :key="step.id" class="rounded-lg border border-slate-200 bg-white p-4">
                        <div class="flex flex-wrap justify-between gap-2">
                            <h4 class="font-semibold">{{ index + 1 }}. {{ step.name }}</h4>
                            <span class="text-sm text-slate-600">{{ step.progress?.status ?? 'pending' }}</span>
                        </div>
                        <p v-if="step.description" class="mt-2 text-sm text-slate-600">{{ step.description }}</p>
                        <p v-if="step.progress?.error" class="mt-2 text-sm text-red-700">{{ step.progress.error }}</p>
                        <details v-if="step.progress?.output != null" class="mt-3">
                            <summary>Step output</summary>
                            <pre>{{ JSON.stringify(step.progress.output, null, 4) }}</pre>
                        </details>
                    </li>
                </ol>
            </section>
            <section v-if="job.results != null" class="execution-panel" aria-labelledby="results-title">
                <h2 id="results-title">Results</h2>
                <pre>{{ JSON.stringify(job.results, null, 4) }}</pre>
            </section>
            <section class="execution-panel" aria-label="Saved execution data">
                <details>
                    <summary>Submitted inputs</summary>
                    <pre>{{ JSON.stringify(job.inputs, null, 4) }}</pre>
                </details>
                <details class="mt-4">
                    <summary>Workflow snapshot</summary>
                    <pre>{{ JSON.stringify(job.workflow, null, 4) }}</pre>
                </details>
            </section>
        </template>
    </BasePage>
</template>

<style scoped>
.execution-panel {
    margin-top: 24px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    color: #0f172a;
    overflow-wrap: anywhere;
}

.execution-panel h2 {
    font-weight: 650;
}

summary {
    cursor: pointer;
    font-weight: 600;
}

pre {
    margin-top: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 13px;
}
</style>
