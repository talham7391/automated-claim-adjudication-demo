import { spawnSync } from 'node:child_process';
import { checkConfig } from './check-config.mjs';
const [environment, action] = process.argv.slice(2);
if (!['staging', 'production'].includes(environment) || !['migrate', 'deploy'].includes(action)) throw new Error('Expected staging|production migrate|deploy');
checkConfig(environment, true);
function run(args) {
 const result = spawnSync('pnpm', ['exec', 'wrangler', ...args], { stdio: 'inherit' });
 if (result.error) throw result.error;
 if (result.status !== 0) process.exit(result.status ?? 1);
}
run(['d1', 'migrations', 'apply', 'DB', '-c', 'apps/jobs/wrangler.json', '--env', environment, '--remote']);
if (action === 'deploy') {
 run(['deploy', '-c', 'apps/jobs/wrangler.json', '--env', environment]);
 run(['deploy', '-c', 'apps/web/wrangler.json', '--env', environment]);
}
