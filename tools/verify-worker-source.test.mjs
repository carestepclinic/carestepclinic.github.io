import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyWorkerSource, EXPECTED_WORKER_SHA256 } from './verify-worker-source.mjs';

test('rejects empty and version-only files', () => {
  for (const text of ['', "const CARESTEP_VERSION='10.7-A.2';\nconst EFSYNC_VERSION='10.7-A.2';\n"]) {
    assert.equal(verifyWorkerSource(Buffer.from(text)).ok, false);
  }
});

test('changing only version labels cannot certify the current stale Worker', t => {
  const text = readFileSync(new URL('../worker.txt', import.meta.url), 'utf8');
  // Once the genuine source is restored, this fixture is no longer the stale source.
  if (!text.includes("const CARESTEP_VERSION='10.5-A'")) return t.skip('The stale Worker has been replaced; retain the version-only rejection test above.');
  assert.equal(verifyWorkerSource(Buffer.from(text.replaceAll('10.5-A', '10.7-A.2'))).ok, false);
});

test('normalizes only CRLF for identity comparison', () => {
  const lf = verifyWorkerSource(Buffer.from('example\n'));
  const crlf = verifyWorkerSource(Buffer.from('example\r\n'));
  const changed = verifyWorkerSource(Buffer.from('example \n'));
  assert.equal(lf.lfSha256, crlf.lfSha256);
  assert.notEqual(lf.rawSha256, crlf.rawSha256);
  assert.notEqual(lf.lfSha256, changed.lfSha256);
  assert.equal(lf.expectedSha256, EXPECTED_WORKER_SHA256);
});
