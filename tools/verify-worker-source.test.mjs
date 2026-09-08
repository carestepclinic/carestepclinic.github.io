import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifyWorkerSource, EXPECTED_WORKER_SHA256, EXPECTED_A2_SHA256 } from './verify-worker-source.mjs';

test('rejects empty and version-only files', () => {
  for (const text of ['', "const CARESTEP_VERSION='10.7-A.2.1';\nconst EFSYNC_VERSION='10.7-A.2.1';\n"]) {
    assert.equal(verifyWorkerSource(Buffer.from(text)).ok, false);
  }
});

test('immutable A.2 remains exact and version-only relabeling is not A.2.1', () => {
  const bytes = readFileSync(new URL('../incoming/worker-v10.7-A.2.txt', import.meta.url));
  // Git may expand newlines on Windows; the repository artifact is LF.
  const text = bytes.toString('utf8').replace(/\r\n/g, '\n');
  assert.equal(createHash('sha256').update(text).digest('hex'), EXPECTED_A2_SHA256);
  assert.equal(verifyWorkerSource(bytes).ok, false);
  assert.equal(verifyWorkerSource(Buffer.from(text.replaceAll('10.7-A.2', '10.7-A.2.1'))).ok, false);
});

test('reviewed corrective Worker passes; appended or changed bytes fail', () => {
  const bytes = readFileSync(new URL('../worker.txt', import.meta.url));
  assert.equal(verifyWorkerSource(bytes).ok, true);
  assert.equal(verifyWorkerSource(Buffer.concat([bytes, Buffer.from('// altered')])).ok, false);
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
