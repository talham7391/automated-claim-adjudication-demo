import type { H3Event } from 'h3';
export function bindings(event: H3Event): Env {
 const env = event.context.cloudflare?.env as Env | undefined;
 if (!env) throw createError({ statusCode: 503, statusMessage: 'Cloudflare bindings unavailable. Use pnpm dev.' });
 return env;
}
