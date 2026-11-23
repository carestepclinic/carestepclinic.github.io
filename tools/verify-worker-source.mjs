import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Recorded in archive commit f02764b, staging/v10.7-a/HOTFIX_A2.md.
// Never replace this with the hash of an unverified candidate to make a check pass.
export const EXPECTED_WORKER_SHA256 =
  '9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7';

export function verifyWorkerSource(bytes) {
  const hash = value => createHash('sha256').update(value).digest('hex');
  const rawSha256 = hash(bytes);
  // Git Windows checkouts may expand LF to CRLF. No other normalization is allowed.
  const lfSha256 = hash(bytes.toString('utf8').replace(/\r\n/g, '\n'));
  const ok = rawSha256 === EXPECTED_WORKER_SHA256 || lfSha256 === EXPECTED_WORKER_SHA256;
  return { ok, rawSha256, lfSha256, expectedSha256: EXPECTED_WORKER_SHA256 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyWorkerSource(readFileSync(new URL('../worker.txt', import.meta.url)));
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      console.error('BLOCKED: worker.txt does not match the recorded v10.7-A.2 source. Do not deploy. See docs/production-source-of-truth.md.');
      process.exitCode = 1;
    } else {
      console.log('Recorded A.2 source hash matched. Manual regression review and production deployment gates still apply.');
    }
  } catch (error) {
    console.error(`BLOCKED: unable to verify Worker source: ${error.message}`);
    process.exitCode = 1;
  }
}
