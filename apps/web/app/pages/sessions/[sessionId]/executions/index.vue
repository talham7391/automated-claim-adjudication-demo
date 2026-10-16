<script setup lang="ts">
import type { JobSummary } from '@demo/db';

definePageMeta({ key: route => route.path });

const route = useRoute();
const sessionPath = `/sessions/${route.params.sessionId}`;
const { data: jobs, error, status, refresh } = await useFetch<JobSummary[]>(`/api${sessionPath}/jobs`);

if (error.value?.statusCode === 404) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found', fatal: true });
}

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

function schedulePoll() {
    pollTimer = setTimeout(async () => {
        if (disposed) return;
        if (error.value || jobs.value?.some(job => ['queued', 'preparing', 'ready', 'running'].includes(job.status))) {
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
    <BasePage class="executions-page">
        <header class="executions-hero">
            <p class="eyebrow">Track your runs</p>
            <div class="hero-heading">
                <h1>Your <span>executions.</span></h1>
                <NuxtLink :to="`${sessionPath}/execute`" class="primary-button">Execute workflow <span aria-hidden="true">→</span></NuxtLink>
            </div>
            <p class="hero-description">Review previous runs, follow active executions, and explore the results of your workflow.</p>
            <p class="session-reference">Session <span>{{ route.params.sessionId }}</span></p>
        </header>
        <section class="history-panel" aria-labelledby="history-title" aria-live="polite">
            <div class="section-heading">
                <h2 id="history-title">Execution history</h2>
                <span v-if="jobs" class="execution-count">{{ jobs.length }} {{ jobs.length === 1 ? 'execution' : 'executions' }}</span>
            </div>
            <div v-if="error" class="error-state" role="alert">
                <p>Unable to load executions.</p>
                <button type="button" class="secondary-button" :disabled="status === 'pending'" @click="refresh()">{{ status === 'pending' ? 'Retrying…' : 'Retry' }}</button>
            </div>
            <p v-else-if="status === 'pending' && !jobs" class="loading-state">Loading executions…</p>
            <div v-else-if="!jobs?.length" class="empty-state">
                <h3>No executions yet</h3>
                <p>Run your saved workflow to see its progress and results here.</p>
                <NuxtLink :to="`${sessionPath}/execute`" class="primary-button">Start an execution <span aria-hidden="true">→</span></NuxtLink>
            </div>
            <ul v-if="jobs?.length" class="execution-list">
                <li v-for="job in jobs" :key="job.uuid">
                    <NuxtLink :to="`${sessionPath}/executions/${job.uuid}`" class="execution-card">
                        <div class="card-heading">
                            <h3>{{ job.description }}</h3>
                            <span class="status-badge" :class="`status-${job.status}`">{{ job.status }}</span>
                        </div>
                        <p class="execution-date"><time :datetime="new Date(job.createdAt).toISOString()">{{ new Date(job.createdAt).toISOString() }}</time></p>
                        <p v-if="job.status === 'ready'" class="ready-note">The workflow is ready to execute.</p>
                        <p v-if="job.error" class="job-error">{{ job.error }}</p>
                        <div class="card-footer">
                            <span class="execution-id">{{ job.uuid }}</span>
                            <span class="view-link">View progress <span aria-hidden="true">→</span></span>
                        </div>
                    </NuxtLink>
                </li>
            </ul>
        </section>
    </BasePage>
</template>

<style scoped>
.executions-page {
    max-width: 1120px;
    margin: 0 auto;
    padding: 24px 28px 56px;
    color: #0f172a;
}

.executions-hero {
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

.hero-heading,
.section-heading,
.card-heading,
.card-footer {
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

.session-reference {
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

.executions-page :is(a, button):focus-visible {
    outline: 2px solid #0f766e;
    outline-offset: 3px;
}

.history-panel {
    padding-top: 32px;
    border-top: 1px solid #e2e8f0;
}

.section-heading {
    margin-bottom: 20px;
}

h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.025em;
}

.execution-count,
.execution-date,
.execution-id,
.ready-note {
    color: #64748b;
    font-size: 12px;
}

.execution-list {
    display: grid;
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.execution-card {
    display: block;
    padding: 24px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    color: inherit;
    text-decoration: none;
    overflow-wrap: anywhere;
}

.execution-card:hover {
    border-color: #99d6ca;
    background: #f0fdfa;
}

.card-heading h3 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.6;
}

.status-badge {
    padding: 5px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    background: #fff;
    color: #475569;
    font-size: 12px;
}

.status-completed {
    border-color: #99d6ca;
    background: #f0fdfa;
    color: #115e59;
}

.status-running,
.status-preparing {
    border-color: #bae6fd;
    background: #f0f9ff;
    color: #0369a1;
}

.status-failed {
    border-color: #fecdd3;
    background: #fff1f2;
    color: #be123c;
}

.execution-date,
.ready-note,
.job-error {
    margin: 12px 0 0;
}

.card-footer {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
}

.view-link {
    color: #0f766e;
    font-size: 13px;
    font-weight: 600;
}

.empty-state,
.error-state,
.loading-state {
    padding: 32px 24px;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    background: #f8fafc;
    text-align: center;
}

.empty-state h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}

.empty-state p {
    margin: 12px 0 24px;
    color: #64748b;
    font-size: 14px;
    line-height: 1.8;
}

.error-state,
.job-error {
    color: #b91c1c;
    font-size: 14px;
}

.loading-state {
    color: #64748b;
    font-size: 14px;
}

@media (max-width: 720px) {
    .executions-page {
        padding: 16px 20px 40px;
    }

    .execution-card {
        padding: 20px;
    }

    .hero-heading > .primary-button {
        width: 100%;
    }
}
</style>
