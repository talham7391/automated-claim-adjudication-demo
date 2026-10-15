<script setup lang="ts">
import Button from 'primevue/button';

definePageMeta({ key: route => route.path });

const route = useRoute();
const testPending = ref(false);
const testResult = ref<string | null>(null);
const testError = ref('');
const { data: session, error } = await useFetch(() => `/api/sessions/${route.params.uuid}`);

if (error.value) {
    throw createError({
        statusCode: error.value.statusCode ?? 500,
        statusMessage: error.value.statusCode === 404 ? 'Session not found' : 'Unable to load session',
        fatal: true
    });
}

async function testAgentOne() {
    if (testPending.value) return;

    testPending.value = true;
    testResult.value = null;
    testError.value = '';
    try {
        const result = await $fetch(`/api/sessions/${route.params.uuid}/test`, { method: 'POST' });
        testResult.value = JSON.stringify(result, null, 4);
    } catch {
        testError.value = 'Unable to run Agent One. Please try again.';
    } finally {
        testPending.value = false;
    }
}
</script>

<template>
    <BasePage>
        <h1>Session</h1>
        <p>Session UUID: {{ session?.uuid }}</p>
        <Button label="Test" :loading="testPending" :disabled="testPending" @click="testAgentOne" />
        <p v-if="testError" role="alert">{{ testError }}</p>
        <pre v-if="testResult !== null" class="whitespace-pre-wrap break-words" aria-live="polite">{{ testResult }}</pre>
    </BasePage>
</template>
