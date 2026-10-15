<script setup lang="ts">
import type { JobSummary } from '@demo/db';
import Button from 'primevue/button';

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
        if (error.value || jobs.value?.some(job => ['queued', 'preparing', 'running'].includes(job.status))) {
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
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold">Executions</h1>
                <p class="mt-2 text-sm text-slate-600 break-all">Session UUID: {{ route.params.sessionId }}</p>
            </div>
            <NuxtLink :to="`${sessionPath}/execute`" class="text-blue-700 underline">Execute workflow</NuxtLink>
        </div>
        <section class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-900" aria-label="Execution history" aria-live="polite">
            <div v-if="error" role="alert">
                <p>Unable to load executions.</p>
                <Button class="mt-3" label="Retry" :loading="status === 'pending'" @click="refresh()" />
            </div>
            <p v-else-if="status === 'pending' && !jobs">Loading executions…</p>
            <p v-else-if="!jobs?.length">No executions yet. Execute your saved workflow to create one.</p>
            <ul v-if="jobs?.length" class="flex flex-col gap-4" :class="{ 'mt-4': error }">
                <li v-for="job in jobs" :key="job.id" class="rounded-lg border border-slate-200 bg-white p-4">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <NuxtLink :to="`${sessionPath}/executions/${job.id}`" class="font-semibold text-blue-700 underline break-words">{{ job.description }}</NuxtLink>
                        <span class="rounded-full bg-slate-100 px-3 py-1 text-sm">{{ job.status }}</span>
                    </div>
                    <p class="mt-2 text-sm text-slate-600"><time :datetime="new Date(job.createdAt).toISOString()">{{ new Date(job.createdAt).toISOString() }}</time></p>
                    <NuxtLink :to="`${sessionPath}/executions/${job.id}`" class="mt-1 block text-sm text-blue-700 break-all">{{ job.id }}</NuxtLink>
                    <p v-if="job.status === 'ready'" class="mt-2 text-sm text-slate-600">Preparation completed; step execution is not implemented yet.</p>
                    <p v-if="job.error" class="mt-2 text-sm text-red-700 break-words">{{ job.error }}</p>
                </li>
            </ul>
        </section>
    </BasePage>
</template>
