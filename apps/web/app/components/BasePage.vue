<script setup lang="ts">
const route = useRoute();
const sessionPath = computed(() => route.params.uuid ? `/sessions/${route.params.uuid}` : null);

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
            <NuxtLink :to="sessionPath" active-class="" exact-active-class="current-page">Edit workflow</NuxtLink>
            <NuxtLink :to="`${sessionPath}/execute`" active-class="" exact-active-class="current-page">Execute workflow</NuxtLink>
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
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 24px;
    border-bottom: 1px solid #e2e8f0;
}

.session-navigation a {
    padding: 12px 0;
    color: #475569;
    border-bottom: 2px solid transparent;
}

.session-navigation a:hover,
.session-navigation .current-page {
    color: #2563eb;
    border-bottom-color: #2563eb;
}

.base-page :deep(button),
.base-page :deep(input),
.base-page :deep(select),
.base-page :deep(textarea) {
    font-family: inherit;
}
</style>
