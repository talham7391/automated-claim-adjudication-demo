<script setup lang="ts">
import Button from 'primevue/button';

const pending = ref(false);
const error = ref('');
const sessions = ref<string[]>([]);
const sessionsStorageKey = 'claim-adjudication:sessions';

onMounted(() => {
    try {
        sessions.value = JSON.parse(localStorage.getItem(sessionsStorageKey) ?? '[]');
    } catch {
        sessions.value = [];
    }
});

async function startSession() {
    if (pending.value) return;

    pending.value = true;
    error.value = '';
    try {
        const session = await $fetch('/api/sessions', { method: 'POST' });
        sessions.value = [session.uuid, ...sessions.value.filter(uuid => uuid !== session.uuid)];
        try {
            localStorage.setItem(sessionsStorageKey, JSON.stringify(sessions.value));
        } catch {
            // Sessions can still be opened when browser storage is unavailable.
        }
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
        <h2>Your sessions</h2>
        <ul v-if="sessions.length">
            <li v-for="uuid in sessions" :key="uuid">
                <NuxtLink :to="`/sessions/${uuid}`">{{ uuid }}</NuxtLink>
            </li>
        </ul>
        <p v-else>No saved sessions yet</p>
    </BasePage>
</template>
