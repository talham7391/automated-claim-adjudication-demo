<script setup lang="ts">
definePageMeta({ key: route => route.path });

const route = useRoute();
const { data: session, error } = await useFetch(() => `/api/sessions/${route.params.uuid}`);

if (error.value) {
    throw createError({
        statusCode: error.value.statusCode ?? 500,
        statusMessage: error.value.statusCode === 404 ? 'Session not found' : 'Unable to load session',
        fatal: true
    });
}
</script>

<template>
    <BasePage>
        <h1>Session</h1>
        <p>Session UUID: {{ session?.uuid }}</p>
        <p>Session features are coming soon.</p>
    </BasePage>
</template>
