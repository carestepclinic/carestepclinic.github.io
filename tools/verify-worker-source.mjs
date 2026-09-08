import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Immutable A.2 audit artifact. Never repin this to a corrective source.
export const EXPECTED_A2_SHA256 =
  '9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7';
// Independently reviewed A.2.2 corrective delta; see docs/worker-a2-1-corrective.md.
export const EXPECTED_WORKER_SHA256 =
  '677e602440017e1ff781524e8da04b00044939ade6d66a4065cdfa0dbbdcc3c9';

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
      console.error('BLOCKED: worker.txt does not match the reviewed v10.7-A.2.2 corrective source. Do not deploy. See docs/worker-a2-1-corrective.md.');
      process.exitCode = 1;
    } else {
      console.log('Reviewed A.2.2 corrective source hash matched. Manual production deployment gates still apply.');
    }
  } catch (error) {
    console.error(`BLOCKED: unable to verify Worker source: ${error.message}`);
    process.exitCode = 1;
  }
}
