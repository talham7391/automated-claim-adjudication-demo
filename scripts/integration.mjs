import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.TEST_BASE_URL || 'http://localhost:8787';
async function request(path, options) {
 const response = await fetch(`${base}${path}`, options);
 assert.ok(response.ok, `${response.status}: ${await response.clone().text()}`);
 return response;
}
const id = randomUUID();
const title = `integration-${id}`;
const post = () => request('/api/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, title }) });
await post();
let record;
for (let attempt = 0; attempt < 60; attempt++) {
 record = await (await request(`/api/records/${id}`)).json();
 if (record.status === 'completed') break;
 await new Promise(resolve => setTimeout(resolve, 500));
}
assert.equal(record.status, 'completed');
assert.equal(record.effectCount, 1);
await post(); // A retried request must resolve to the same instance and record.
record = await (await request(`/api/records/${id}`)).json();
assert.equal(record.effectCount, 1);
const all = await (await request('/api/records')).json();
assert.equal(all.filter(record => record.id === id).length, 1);
const html = await (await request('/')).text();
assert.ok(html.includes(title));
assert.match(html, /completed/);
console.log(`Verified API → workflow → D1 → API/SSR and POST retry: ${id}`);
