<script setup lang="ts">
import Button from 'primevue/button';

const pending = ref(false);
const error = ref('');

async function startSession() {
    if (pending.value) return;

    pending.value = true;
    error.value = '';
    try {
        const session = await $fetch('/api/sessions', { method: 'POST' });
        await navigateTo(`/sessions/${session.uuid}`);
    } catch {
        error.value = 'Unable to start a session. Please try again.';
    } finally {
        pending.value = false;
    }
}
</script>

<template>
    <BasePage>
        <h1>Prescription claim adjudication</h1>
        <Button label="Start session" :loading="pending" :disabled="pending" @click="startSession" />
        <p v-if="error" role="alert">{{ error }}</p>
    </BasePage>
</template>
