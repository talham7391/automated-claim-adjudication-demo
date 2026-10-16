<script setup lang="ts">
const route = useRoute();
const sessionPath = computed(() => route.params.sessionId ? `/sessions/${route.params.sessionId}` : null);

useHead({
    link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'
        }
    ]
});
</script>

<template>
    <main class="base-page">
        <nav v-if="sessionPath" class="session-navigation" aria-label="Session workflow">
            <NuxtLink to="/" class="all-sessions">← All sessions</NuxtLink>
            <NuxtLink :to="sessionPath" active-class="" exact-active-class="current-page">Edit workflow</NuxtLink>
            <NuxtLink :to="`${sessionPath}/execute`" active-class="" exact-active-class="current-page">Execute workflow</NuxtLink>
            <NuxtLink :to="`${sessionPath}/executions`" active-class="current-page">Executions</NuxtLink>
        </nav>
        <slot />
    </main>
</template>

<style scoped>
.base-page {
    font-family: 'Inter', sans-serif;
}

.session-navigation {
    display: flex;
    width: fit-content;
    max-width: 100%;
    gap: 4px;
    margin-bottom: 24px;
    padding: 5px;
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #f8fafc;
}

.session-navigation a {
    flex-shrink: 0;
    padding: 11px 18px;
    border: 1px solid transparent;
    border-radius: 10px;
    color: #64748b;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
    text-decoration: none;
    white-space: nowrap;
    transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}

.session-navigation a:hover {
    color: #0f766e;
    background: #f0fdfa;
}

.session-navigation .all-sessions {
    margin-right: 4px;
    border-right-color: #e2e8f0;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
}

.session-navigation .current-page {
    border-color: #d5e9e5;
    background: #fff;
    color: #0f766e;
    box-shadow: 0 1px 3px #0f172a0a;
}

.session-navigation a:focus-visible {
    outline: 2px solid #0f766e;
    outline-offset: -2px;
}

@media (max-width: 480px) {
    .session-navigation a {
        padding: 10px 12px;
        font-size: 12px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .session-navigation a {
        transition: none;
    }
}

.base-page :deep(button),
.base-page :deep(input),
.base-page :deep(select),
.base-page :deep(textarea) {
    font-family: inherit;
}
</style>
