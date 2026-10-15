import { test } from 'node:test';
import { checkConfig } from '../scripts/check-config.mjs';
import assert from 'node:assert/strict';
for (const environment of ['local', 'staging', 'production']) test(`${environment} bindings agree`, () => { checkConfig(environment); });
test('remote commands reject placeholder IDs', () => { assert.throws(() => checkConfig('staging', true), /real staging D1 IDs/); });
