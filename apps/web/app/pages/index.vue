<script setup lang="ts">
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
        <div class="home-page">
            <header class="hero">
                <p class="eyebrow">Automated claim adjudication · Demo</p>
                <h1>From prescription to decision.</h1>
                <p class="hero-description">
                    Explore how AI and configurable workflows can help process prescription claims.
                    Create a session, define your steps, and follow an execution from input to result.
                </p>
                <div class="hero-actions">
                    <button
                        type="button"
                        class="start-button"
                        :disabled="pending"
                        :aria-busy="pending"
                        @click="startSession"
                    >
                        <span v-if="pending" class="loading-spinner" aria-hidden="true"></span>
                        {{ pending ? 'Starting session…' : 'Start session' }}
                        <span v-if="!pending" aria-hidden="true">→</span>
                    </button>
                    <a href="#demo-video">Explore the demo <span aria-hidden="true">↗</span></a>
                </div>
                <p v-if="error" class="error-message" role="alert">{{ error }}</p>
            </header>

            <div class="overview">
                <section class="motivation" aria-labelledby="motivation-heading">
                    <p class="eyebrow">The why</p>
                    <h2 id="motivation-heading">Motivation</h2>
                    <p>
                        Prescription claims bring together documents, coverage rules, and decisions.
                        Moving between these pieces by hand can make the process slow and difficult to follow.
                    </p>
                    <p>
                        This demo explores a more connected approach: use AI to extract and reason about
                        information, connect it to workflow steps, and make each step's inputs and outputs visible.
                    </p>
                    <div class="motivation-note">
                        <span class="note-marker" aria-hidden="true"></span>
                        <p>A space to explore the process, understand the results, and refine the workflow.</p>
                    </div>
                </section>

                <section id="demo-video" class="demo" aria-labelledby="demo-heading">
                    <div class="section-heading">
                        <h2 id="demo-heading">See it in action</h2>
                    </div>
                    <iframe
                        class="demo-video"
                        width="560"
                        height="315"
                        src="https://www.youtube.com/embed/n4MSGxmc0RM?si=HkUO2I-Q4oyK4Sa-"
                        title="YouTube video player"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerpolicy="strict-origin-when-cross-origin"
                        allowfullscreen
                    ></iframe>
                    <p class="video-caption">From creating a session to reviewing execution results.</p>
                </section>
            </div>

            <section class="sessions" aria-labelledby="sessions-heading">
                <div class="section-heading">
                    <div>
                        <p class="eyebrow">Pick up where you left off</p>
                        <h2 id="sessions-heading">Your sessions</h2>
                    </div>
                    <span class="session-count">{{ sessions.length }} saved</span>
                </div>
                <ul v-if="sessions.length" class="session-list">
                    <li v-for="uuid in sessions" :key="uuid">
                        <NuxtLink :to="`/sessions/${uuid}`">
                            <span class="session-id">{{ uuid }}</span>
                            <span class="session-open">Open session <span aria-hidden="true">→</span></span>
                        </NuxtLink>
                    </li>
                </ul>
                <div v-else class="empty-sessions">
                    <p>No saved sessions yet</p>
                    <p>Start your first session to build and explore a claim workflow.</p>
                </div>
            </section>
        </div>
    </BasePage>
</template>

<style scoped>
.start-button {
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
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
}

.start-button:hover:not(:disabled) {
    border-color: #115e59;
    background: #115e59;
}

.start-button:disabled {
    opacity: 0.65;
    cursor: wait;
}

.home-page :is(a, button):focus-visible {
    outline: 2px solid #0f766e;
    outline-offset: 5px;
}

.loading-spinner {
    width: 15px;
    height: 15px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 800ms linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    .start-button {
        transition: none;
    }

    .loading-spinner {
        animation: none;
    }
}

.home-page {
    max-width: 1120px;
    margin: 0 auto;
    padding: 72px 28px 56px;
    color: #0f172a;
}

.hero {
    max-width: 800px;
    padding-bottom: 64px;
}

.eyebrow {
    margin: 0 0 16px;
    color: #0f766e;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
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
    max-width: 620px;
    margin: 24px 0;
    color: #475569;
    font-size: 17px;
    line-height: 1.8;
}

.hero-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 24px;
}

.hero-actions a {
    color: #334155;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
}

.hero-actions a:hover {
    text-decoration: underline;
}

.error-message {
    margin-top: 16px;
    color: #b91c1c;
}

.overview {
    display: grid;
    grid-template-columns: 1fr 1.15fr;
    gap: 56px;
    padding: 40px 0 48px;
    border-top: 1px solid #e2e8f0;
}

h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.025em;
}

.motivation > p:not(.eyebrow) {
    margin: 20px 0 0;
    color: #475569;
    font-size: 15px;
    line-height: 1.8;
}

.motivation-note {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-top: 24px;
    padding: 16px;
    border-radius: 12px;
    background: #f0fdfa;
}

.note-marker {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0d9488;
}

.motivation-note p {
    margin: 0;
    color: #115e59;
    font-size: 13px;
    line-height: 1.7;
}

.section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 20px;
}

.session-count {
    color: #64748b;
    font-size: 12px;
}

.demo-video {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    border: 0;
    border-radius: 16px;
}

.video-caption {
    margin: 12px 0 0;
    color: #64748b;
    font-size: 12px;
}

.sessions {
    padding-top: 32px;
    border-top: 1px solid #e2e8f0;
}

.sessions .eyebrow {
    margin-bottom: 8px;
}

.empty-sessions {
    padding: 28px;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    background: #f8fafc;
    text-align: center;
}

.empty-sessions p {
    margin: 0;
    color: #334155;
    font-size: 14px;
}

.empty-sessions p + p {
    margin-top: 8px;
    color: #64748b;
    font-size: 13px;
}

.session-list {
    margin: 0;
    padding: 0;
    list-style: none;
}

.session-list a {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 18px 16px;
    border-bottom: 1px solid #e2e8f0;
    color: #334155;
    font-size: 14px;
    text-decoration: none;
}

.session-list a:hover {
    background: #f0fdfa;
}

.session-id {
    overflow-wrap: anywhere;
}

.session-open {
    color: #0f766e;
    font-weight: 600;
}

@media (max-width: 720px) {
    .home-page {
        padding: 40px 20px;
    }

    .hero {
        padding-bottom: 40px;
    }

    .overview {
        grid-template-columns: 1fr;
        gap: 36px;
        padding-top: 32px;
    }
}
</style>
