<script setup lang="ts">
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
        <slot />
    </main>
</template>

<style scoped>
.base-page {
    font-family: 'Inter', sans-serif;
}

.base-page :deep(button),
.base-page :deep(input),
.base-page :deep(select),
.base-page :deep(textarea) {
    font-family: inherit;
}
</style>
