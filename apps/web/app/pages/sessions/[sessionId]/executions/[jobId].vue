<script setup lang="ts">
import type { JobDetail } from '@demo/db';

definePageMeta({ key: route => route.path });

const route = useRoute();
const sessionPath = `/sessions/${route.params.sessionId}`;
const { data: job, error, status, refresh } = await useFetch<JobDetail>(`/api${sessionPath}/jobs/${route.params.jobId}`);

if (error.value?.statusCode === 404) {
    throw createError({ statusCode: 404, statusMessage: 'Execution not found', fatal: true });
}

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
        if (error.value || (job.value && ['queued', 'preparing', 'ready', 'running'].includes(job.value.status))) {
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
    <BasePage class="detail-page">
        <header class="detail-hero">
            <p class="eyebrow">Follow your process</p>
            <div class="hero-heading">
                <h1>Execution <span>progress.</span></h1>
                <NuxtLink :to="`${sessionPath}/execute`" class="primary-button">New execution <span aria-hidden="true">→</span></NuxtLink>
            </div>
            <p class="hero-description">Follow each step through your saved workflow. Select a step's details to inspect its configuration, output, or errors.</p>
            <p class="execution-reference">Execution <span>{{ route.params.jobId }}</span></p>
        </header>
        <div v-if="error" class="execution-panel error-state" role="alert">
            <p>Unable to load execution details.</p>
            <button type="button" class="secondary-button" :disabled="status === 'pending'" @click="refresh()">{{ status === 'pending' ? 'Retrying…' : 'Retry' }}</button>
        </div>
        <p v-else-if="!job" class="execution-panel loading-state" role="status">Loading execution details…</p>
        <template v-if="job">
            <p v-if="job.error" class="execution-panel error-state" role="alert">{{ job.error }}</p>
            <WorkflowVisualization :workflow="job.workflow" :status="job.status" :progress="job.progress" />
            <section class="execution-panel" aria-labelledby="execution-timing-title">
                <div class="section-heading">
                    <h2 id="execution-timing-title">Execution timeline</h2>
                    <p v-if="['queued', 'preparing', 'ready', 'running'].includes(job.status)" class="live-note">Progress updates automatically</p>
                </div>
                <dl class="timestamps">
                    <div v-for="timestamp in timestamps" :key="timestamp.label">
                        <dt>{{ timestamp.label }}</dt>
                        <dd>
                            <time v-if="timestamp.value != null" :datetime="new Date(timestamp.value).toISOString()">{{ new Date(timestamp.value).toISOString() }}</time>
                            <span v-else>—</span>
                        </dd>
                    </div>
                </dl>
            </section>
            <section v-if="job.results != null" class="execution-panel results-panel" aria-labelledby="results-title">
                <p class="eyebrow">Workflow output</p>
                <h2 id="results-title">Results</h2>
                <pre>{{ JSON.stringify(job.results, null, 4) }}</pre>
            </section>
            <section class="execution-panel" aria-labelledby="saved-data-title">
                <h2 id="saved-data-title">Execution data</h2>
                <p class="section-description">The inputs and workflow saved for this execution.</p>
                <details>
                    <summary>Submitted inputs</summary>
                    <pre>{{ JSON.stringify(job.inputs, null, 4) }}</pre>
                </details>
                <details>
                    <summary>Workflow snapshot</summary>
                    <pre>{{ JSON.stringify(job.workflow, null, 4) }}</pre>
                </details>
            </section>
        </template>
    </BasePage>
</template>

<style scoped>
.detail-page {
    max-width: 1120px;
    margin: 0 auto;
    padding: 24px 28px 56px;
    color: #0f172a;
}

.detail-hero {
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

.hero-heading,
.section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
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

.execution-reference {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    color: #64748b;
    font-size: 12px;
    overflow-wrap: anywhere;
}

.primary-button,
.secondary-button {
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

.primary-button:hover {
    background: #115e59;
}

.secondary-button {
    margin-top: 12px;
    background: #fff;
    color: #0f766e;
}

.secondary-button:hover:not(:disabled) {
    background: #f0fdfa;
}

.secondary-button:disabled {
    opacity: 0.65;
    cursor: wait;
}

.detail-page :is(a, button, summary):focus-visible {
    outline: 2px solid #0f766e;
    outline-offset: 3px;
}

.execution-panel {
    margin-top: 24px;
    padding: 28px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    overflow-wrap: anywhere;
}

h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.025em;
}

.live-note,
.section-description {
    color: #64748b;
    font-size: 13px;
    line-height: 1.7;
}

.timestamps {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 24px;
    margin: 24px 0 0;
}

.timestamps dt {
    margin-bottom: 8px;
    color: #64748b;
    font-size: 12px;
}

.timestamps dd {
    margin: 0;
    color: #334155;
    font-size: 13px;
    line-height: 1.7;
}

.results-panel {
    border-color: #cce7e0;
    background: #f0fdfa;
}

.error-state {
    border-color: #fecdd3;
    background: #fff1f2;
    color: #b91c1c;
    font-size: 14px;
}

.loading-state {
    color: #64748b;
    font-size: 14px;
}

details {
    margin-top: 16px;
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
}

summary {
    color: #0f766e;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}

pre {
    margin: 16px 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: #334155;
    font-size: 12px;
    line-height: 1.8;
}

@media (max-width: 720px) {
    .detail-page {
        padding: 16px 20px 40px;
    }

    .execution-panel {
        padding: 20px;
    }

    .timestamps {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .hero-heading > .primary-button {
        width: 100%;
    }
}
</style>
