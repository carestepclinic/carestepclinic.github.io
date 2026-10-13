// Read-only public verification; never calls the Worker or writes a remote resource.
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as wait} from 'node:timers/promises';
import {readUI} from './check-ui.mjs';

const origin = 'https://carestepclinic.github.io/';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function verifyUI(root, paths, {fetchImpl = fetch, attempts = 6, delay = wait} = {}) {
  if (!paths.length) throw Error('Provide the exact committed frontend filenames.');
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 6) throw Error('INVALID_ATTEMPTS');
  // Validate every local target before issuing any request.
  const targets = [...new Set(paths)].map(path => ({path, bytes: readUI(root, path)}));
  const verified = [];
  for (const {path, bytes} of targets) {
    const expected = sha256(bytes);
    let last = 'NO_RESPONSE';
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const url = new URL(path, origin);
      url.searchParams.set('verify', expected.slice(0, 16));
      const response = await fetchImpl(url, {method:'GET', redirect:'error', credentials:'omit', headers:{'Cache-Control':'no-cache'}, signal:AbortSignal.timeout(15000)});
      if (response.redirected || response.url && new URL(response.url).origin !== origin.slice(0,-1)) throw Error(`REDIRECT_BLOCK: ${path}`);
      if ([401,403].includes(response.status)) throw Error(`ACCESS_BLOCK: ${path} HTTP ${response.status}`);
      if (response.status !== 200) {
        await response.body?.cancel();
        last = `HTTP_${response.status}`;
      } else {
        const actual = Buffer.from(await response.arrayBuffer());
        if (actual.equals(bytes)) {
          verified.push({file:path, bytes:bytes.length, sha256:expected, attempts:attempt, result:'BYTE_MATCH'});
          break;
        }
        last = `BYTE_MISMATCH expected=${expected} actual=${sha256(actual)}`;
      }
      if (attempt === attempts) throw Error(`PUBLIC_VERIFY_FAILED ${path}: ${last}`);
      await delay(5000);
    }
  }
  return verified;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify({ok:true, publicFiles:await verifyUI(process.cwd(), process.argv.slice(2))}, null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
