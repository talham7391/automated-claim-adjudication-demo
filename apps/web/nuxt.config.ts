import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

const appPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: 'var(--color-blue-50)',
            100: 'var(--color-blue-100)',
            200: 'var(--color-blue-200)',
            300: 'var(--color-blue-300)',
            400: 'var(--color-blue-400)',
            500: 'var(--color-blue-500)',
            600: 'var(--color-blue-600)',
            700: 'var(--color-blue-700)',
            800: 'var(--color-blue-800)',
            900: 'var(--color-blue-900)',
            950: 'var(--color-blue-950)'
        }
    }
});

export default defineNuxtConfig({
    compatibilityDate: '2026-10-01',
    devtools: { enabled: false },
    modules: ['@primevue/nuxt-module'],
    css: ['~/assets/css/main.css'],
    vite: {
        plugins: [tailwindcss()]
    },
    primevue: {
        options: {
            theme: {
                preset: appPreset,
                options: { darkModeSelector: false }
            }
        }
    },
    nitro: {
        virtual: {
            'virtual:workflow-instructions': `export default ${JSON.stringify(readFileSync(new URL('../../agents/how_to_understand_workflows.md', import.meta.url), 'utf8'))};`
        },
        preset: 'cloudflare_module',
        cloudflare: { deployConfig: false, nodeCompat: true }
    }
});
