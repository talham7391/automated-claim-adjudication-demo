import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export function checkConfig(environment = 'local', remote = false) {
 if (!['local', 'staging', 'production'].includes(environment)) throw new Error('Invalid environment');
 const configs = ['web', 'jobs'].map(app => {
  const config = JSON.parse(readFileSync(new URL(`../apps/${app}/wrangler.json`, import.meta.url)));
  return environment === 'local' ? config : { ...config, ...config.env[environment] };
 });
 const [web, jobs] = configs;
 const db = configs.map(config => config.d1_databases.find(db => db.binding === 'DB'));
 if (db.some(binding => !binding) || db[0].database_id !== db[1].database_id || db[0].database_name !== db[1].database_name) throw new Error('Workers must share the same D1 database');
 const otherIds = ['local', 'staging', 'production'].map(env => {
  const c = JSON.parse(readFileSync(new URL('../apps/jobs/wrangler.json', import.meta.url)));
  return (env === 'local' ? c : c.env[env]).d1_databases[0].database_id;
 });
 if (new Set(otherIds).size !== 3) throw new Error('Environments must have separate databases');
 const [producer, consumer] = configs.map(c => c.workflows.find(w => w.binding === 'RECORD_WORKFLOW'));
 if (producer.script_name !== jobs.name || producer.name !== consumer.name || producer.class_name !== consumer.class_name) throw new Error('Workflow binding mismatch');
 for (const [index, binding] of db.entries()) {
  if (resolve(`apps/${index === 0 ? 'web' : 'jobs'}`, binding.migrations_dir) !== resolve('packages/db/migrations')) throw new Error('Migration directory mismatch');
 }
 if (remote && /^00000000-/.test(db[0].database_id)) throw new Error(`Configure real ${environment} D1 IDs in both Wrangler files first`);
 return { web, jobs };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 for (const env of ['local', 'staging', 'production']) { checkConfig(env); console.log(`${env}: shared D1 and workflow configuration matches`); }
}
