// Local workerd/D1 only. No Wrangler config, remote binding, credentials or .env loading.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { EXPECTED_WORKER_SHA256, EXPECTED_A2_SHA256 } from '../verify-worker-source.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const worker = readFileSync(new URL('../../worker.txt', import.meta.url), 'utf8');
const audit = readFileSync(new URL('../../incoming/worker-v10.7-A.2.txt', import.meta.url), 'utf8');
const mainRef = '26395b304c94ea40a016c44b2e815da828e91c75';
const main = execFileSync(process.env.CARESTEP_GIT || 'git', ['show', `${mainRef}:worker.txt`], { cwd: root, encoding: 'utf8', maxBuffer: 5e6 });
const hash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
assert.equal(hash(worker), EXPECTED_WORKER_SHA256);
assert.equal(hash(audit), EXPECTED_A2_SHA256);
const exports = 'ensureSaasDb,efSyncEnsureSchema,efSyncLedgerMark,saasEmrSyncStatus,handleEfriendsSyncRequest';

// This wrapper calls unchanged Worker functions inside workerd. D1 batch is forwarded
// intact (including native transaction semantics); only SQL submission order is logged.
async function dispatch(request, binding) {
  const b = await request.json(), api = versions[b.version || 'candidate'];
  const trace = [];
  const wrap = (raw, query) => ({
    raw, query,
    bind(...values) { return wrap(raw.bind(...values), query); },
    async run() { trace.push(query); return raw.run(); },
    async all() { trace.push(query); return raw.all(); },
    async first(...args) { trace.push(query); return raw.first(...args); }
  });
  const DB = {
    prepare(query) { return wrap(binding.DB.prepare(query), query); },
    async batch(statements) { trace.push(...statements.map(x => x.query)); return binding.DB.batch(statements.map(x => x.raw)); }
  };
  const env = { DB, EFRIENDS_SYNC_CLINIC_ID: b.clinic || 'clinic-A', EFRIENDS_SYNC_API_KEY: 'isolated-test-auth-key-123456789', CARESTEP_PATIENT_DATA_KEY: 'isolated-test-encryption-key-not-production' };
  try {
    let value;
    if (b.op === 'init') { await api.ensureSaasDb(env); await api.efSyncEnsureSchema(env); }
    else if (b.op === 'legacy-ledger-init') await api.efSyncEnsureSchema(env);
    else if (b.op === 'ledger') value = await api.efSyncLedgerMark(env, env.EFRIENDS_SYNC_CLINIC_ID, ...b.args);
    else if (b.op === 'status') value = await api.saasEmrSyncStatus(env, { clinic_id: env.EFRIENDS_SYNC_CLINIC_ID, role: 'owner' });
    else if (b.op === 'route') {
      const r = await api.handleEfriendsSyncRequest(new Request('https://offline.invalid/efriends/v1/' + b.path, {
        method: b.body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + env.EFRIENDS_SYNC_API_KEY, 'Content-Type': 'application/json' },
        ...(b.body ? { body: JSON.stringify(b.body) } : {})
      }), env);
      value = { status: r.status, body: await r.json() };
    } else if (b.op === 'probe-egress') { value = (await fetch('https://offline.invalid/egress-probe')).status; }
    else throw new Error('Unsupported isolated operation');
    return Response.json({ ok: true, value, trace });
  } catch (error) { return Response.json({ ok: false, error: error.message, trace }); }
}
const wrapper = `import * as candidate from './candidate.mjs';
import * as repeated from './repeated.mjs';
import * as old from './main.mjs';
import * as audit from './audit.mjs';
const versions = {candidate,repeated,main:old,audit};
export default {fetch:${dispatch.toString()}};`;
const results = [], instances = [];
let blockedEgress = 0;
async function fixture(label) {
  const mf = new Miniflare({
    cf: false, // Disable even Miniflare's public request.cf metadata download.
    name: 'isolated-readiness-' + label, host: '127.0.0.1', port: 0,
    compatibilityDate: '2026-07-30', d1Databases: { DB: 'synthetic-' + label }, d1Persist: false,
    modules: [
      { type: 'ESModule', path: 'wrapper.mjs', contents: wrapper },
      ...[['candidate', worker], ['repeated', worker], ['main', main], ['audit', audit]].map(([name, text]) => ({ type: 'ESModule', path: name + '.mjs', contents: text + '\nexport {' + exports.split(',').filter(name => text.includes('function ' + name + '(')).join(',') + '};' }))
    ],
    outboundService() { blockedEgress++; return new Response('External access denied by isolated fixture', { status: 403 }); }
  });
  instances.push(mf);
  const DB = await mf.getD1Database('DB');
  const query = async (sql, ...values) => (await DB.prepare(sql).bind(...values).all()).results;
  const rpc = async b => {
    const result = await (await mf.dispatchFetch('http://localhost/test', { method: 'POST', body: JSON.stringify(b) })).json();
    assert.equal(result.ok, true, JSON.stringify(result));
    return result;
  };
  const schema = () => query("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name");
  return { mf, DB, query, rpc, schema };
}
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.stack }); }
}
function order(trace, fresh = false) {
  const position = pattern => { const p = trace.findIndex(s => pattern.test(s)); assert.ok(p >= 0, String(pattern)); return p; };
  const index = position(/CREATE INDEX IF NOT EXISTS idx_care_home_followups_consult_status/);
  for (const col of ['consult_status', 'consult_updated_at']) {
    const columnAt = fresh ? position(new RegExp('CREATE TABLE IF NOT EXISTS care_home_followups[\\s\\S]*\\b' + col + '\\b')) : position(new RegExp('ALTER TABLE care_home_followups ADD COLUMN ' + col + '\\b'));
    assert.ok(columnAt < index);
  }
  assert.ok(position(/CREATE TABLE IF NOT EXISTS care_patients\s*\(/) < position(/CREATE TRIGGER IF NOT EXISTS trg_care_followup_cases_patient_delete/));
}
async function schemaAssertions(f) {
  const pk = (await f.query('PRAGMA table_info(efriends_sync_ledger_v2)')).filter(x => x.pk).sort((a,b) => a.pk-b.pk).map(x => x.name);
  assert.deepEqual(pk, ['clinic_id', 'record_key']);
  for (const name of ['idx_care_home_followups_consult_status', 'trg_care_followup_cases_patient_delete']) assert.equal((await f.query('SELECT name FROM sqlite_master WHERE name=?', name)).length, 1);
  const indexes = await f.query('PRAGMA index_list(efriends_sync_ledger_v2)');
  assert.equal(indexes.filter(x => x.origin === 'c').length, 2);
}
const stamp = '2026-09-08T00:00:00Z';
const mark = (clinic, id, state='synced', version='candidate') => ({ op:'ledger', version, clinic, args:['patient',{externalPatientId:id},state,stamp,clinic+'-patient',clinic+'-run',''] });
try {
  const fresh = await fixture('fresh'), legacy = await fixture('legacy');
  await check('fresh D1 bootstrap: empty tables, ordered columns/index/trigger, composite PK', async () => {
    assert.equal((await fresh.schema()).filter(x => x.type === 'table').length, 0);
    const result = await fresh.rpc({ op:'init' }); order(result.trace, true); await schemaAssertions(fresh);
  });
  await check('fresh D1 cold reinitialization is idempotent', async () => {
    const before = await fresh.schema(); await fresh.rpc({ op:'init',version:'repeated' }); assert.deepEqual(await fresh.schema(), before);
  });
  let legacyRows, legacyPK;
  await check('legacy fixture: pinned main missing consult columns and collided A.2 ledger', async () => {
    await legacy.rpc({ op:'init',version:'main' });
    const cols = await legacy.query('PRAGMA table_info(care_home_followups)');
    assert.equal(cols.some(x => ['consult_status','consult_updated_at'].includes(x.name)), false);
    await legacy.rpc({ op:'legacy-ledger-init',version:'audit' });
    for (const clinic of ['clinic-A','clinic-B']) await legacy.rpc(mark(clinic,'same-legacy-id','synced','audit'));
    legacyRows = await legacy.query('SELECT * FROM efriends_sync_ledger ORDER BY record_key');
    assert.equal(legacyRows.length, 1);
    assert.equal(legacyRows[0].clinic_id,'clinic-A'); assert.equal(legacyRows[0].carestep_id,'clinic-B-patient');
    legacyPK = await legacy.query('PRAGMA table_info(efriends_sync_ledger)');
  });
  await check('legacy D1 upgrade: ordered schema, original rows/PK preserved, no backfill', async () => {
    const result = await legacy.rpc({op:'init'}); order(result.trace); await schemaAssertions(legacy);
    assert.deepEqual(await legacy.query('SELECT * FROM efriends_sync_ledger ORDER BY record_key'),legacyRows);
    assert.deepEqual(await legacy.query('PRAGMA table_info(efriends_sync_ledger)'),legacyPK);
    assert.equal((await legacy.query('SELECT * FROM efriends_sync_ledger_v2')).length,0);
  });
  await check('legacy D1 second upgrade is idempotent and preserves legacy evidence', async () => {
    const before=await legacy.schema(); await legacy.rpc({op:'init',version:'repeated'});
    assert.deepEqual(await legacy.schema(),before);
    assert.deepEqual(await legacy.query('SELECT * FROM efriends_sync_ledger ORDER BY record_key'),legacyRows);
    assert.equal((await legacy.query('SELECT * FROM efriends_sync_ledger_v2')).length,0);
  });
  await check('ledgerLastSeen is empty with legacy-only evidence and another clinic observation', async () => {
    assert.equal((await legacy.rpc({op:'status'})).value.integrity.ledgerLastSeen,'');
    await legacy.rpc(mark('clinic-B','same-id'));
    assert.equal((await legacy.rpc({op:'status'})).value.integrity.ledgerLastSeen,'');
    assert.equal((await legacy.rpc({op:'status',clinic:'clinic-B'})).value.integrity.ledgerLastSeen,stamp);
  });
  await check('same record_key stays independent across clinics and repeated writes', async () => {
    const before = await legacy.query("SELECT * FROM efriends_sync_ledger_v2 WHERE clinic_id='clinic-B'");
    for(let n=0;n<2;n++) await legacy.rpc(mark('clinic-A','same-id','retry'));
    const rows=await legacy.query('SELECT * FROM efriends_sync_ledger_v2 ORDER BY clinic_id');
    assert.equal(rows.length,2); assert.equal(rows[0].record_key,rows[1].record_key);
    assert.equal(rows[0].carestep_id,'clinic-A-patient'); assert.equal(rows[0].run_id,'clinic-A-run'); assert.equal(rows[0].status,'retry');
    assert.deepEqual(await legacy.query("SELECT * FROM efriends_sync_ledger_v2 WHERE clinic_id='clinic-B'"),before);
    assert.deepEqual(await legacy.query('SELECT * FROM efriends_sync_ledger ORDER BY record_key'),legacyRows);
  });
  const route = async (clinic,path,body) => {
    const r=(await fresh.rpc({op:'route',clinic,path,body})).value; assert.ok(r.status>=200 && r.status<300,JSON.stringify(r));return r.body;
  };
  await check('normal nonempty sync-batch creates clinic-scoped patients and ledger observations', async () => {
    assert.equal((await fresh.rpc({op:'status'})).value.integrity.ledgerLastSeen,'');
    for(const clinic of ['clinic-A','clinic-B']) {
      const r=await route(clinic,'sync-batch',{runId:clinic+'-normal',guardians:[{externalGuardianId:'same-guardian',name:'Synthetic Guardian'}],patients:[{externalPatientId:'same-patient',externalGuardianId:'same-guardian',name:'Synthetic Patient',species:'dog'}]});
      assert.equal(r.ok,true,JSON.stringify(r)); assert.equal(r.patientsCreated,1);
    }
    const rows=await fresh.query("SELECT * FROM efriends_sync_ledger_v2 WHERE entity_kind='patient' ORDER BY clinic_id");
    assert.equal(rows.length,2);assert.equal(rows[0].record_key,rows[1].record_key);assert.notEqual(rows[0].carestep_id,rows[1].carestep_id);
    for(const row of rows) assert.equal((await fresh.rpc({op:'status',clinic:row.clinic_id})).value.integrity.ledgerLastSeen,row.last_seen_at);
  });
  await check('actual retry resolves only clinic A while clinic B queue and ledger stay untouched', async () => {
    for(const clinic of ['clinic-A','clinic-B']) {
      const r=await route(clinic,'sync-batch',{patients:[{externalPatientId:'retry-patient',externalGuardianId:'missing-guardian',name:'Retry Patient'}]});assert.equal(r.queued,1);
    }
    await route('clinic-A','sync-batch',{guardians:[{externalGuardianId:'missing-guardian',name:'Synthetic Retry Guardian'}]});
    await fresh.query("UPDATE efriends_sync_failures SET next_retry_at='' WHERE status='retry'");
    const beforeLedger=await fresh.query("SELECT * FROM efriends_sync_ledger_v2 WHERE clinic_id='clinic-B' ORDER BY record_key");
    const beforeQueue=await fresh.query("SELECT * FROM efriends_sync_failures WHERE clinic_id='clinic-B'");
    const retry=await route('clinic-A','retry-due',{}); assert.equal(retry.resolved,1);assert.equal(retry.retried,1);
    assert.deepEqual(await fresh.query("SELECT * FROM efriends_sync_ledger_v2 WHERE clinic_id='clinic-B' ORDER BY record_key"),beforeLedger);
    assert.deepEqual(await fresh.query("SELECT * FROM efriends_sync_failures WHERE clinic_id='clinic-B'"),beforeQueue);
    const row=(await fresh.query("SELECT * FROM efriends_sync_ledger_v2 WHERE clinic_id='clinic-A' AND run_id='retry-queue'"))[0];
    assert.equal(row.status,'synced');assert.ok(row.carestep_id);
    assert.equal((await fresh.rpc({op:'status'})).value.integrity.ledgerLastSeen,row.last_seen_at);
    assert.equal((await fresh.rpc({op:'status'})).value.integrity.retry,0);
    assert.equal((await fresh.rpc({op:'status',clinic:'clinic-B'})).value.integrity.retry,1);
  });
  await check('actual retry reaches dead-letter on third failure without affecting another clinic', async () => {
    for(let i=0;i<2;i++) {await fresh.query("UPDATE efriends_sync_failures SET next_retry_at='' WHERE clinic_id='clinic-B'");await route('clinic-B','retry-due',{});}
    const row=(await fresh.query("SELECT * FROM efriends_sync_failures WHERE clinic_id='clinic-B'"))[0];
    assert.equal(row.attempt_count,3);assert.equal(row.status,'dead_letter');
    assert.equal((await fresh.rpc({op:'status',clinic:'clinic-B'})).value.integrity.deadLetter,1);
    assert.equal((await fresh.rpc({op:'status'})).value.integrity.deadLetter,0);
  });
  await check('real sync quarantines conflicting identity and isolates queue/status by clinic', async () => {
    const first=await route('clinic-A','sync-batch',{guardians:[{externalGuardianId:'phone-one',name:'Synthetic One',phone:'01000000000'}]});assert.equal(first.ok,true);
    const conflict=await route('clinic-A','sync-batch',{guardians:[{externalGuardianId:'phone-two',name:'Synthetic Two',phone:'01000000000'}]});assert.equal(conflict.quarantined,1);
    assert.equal((await fresh.rpc({op:'status'})).value.integrity.quarantine,1);
    assert.equal((await fresh.rpc({op:'status',clinic:'clinic-B'})).value.integrity.quarantine,0);
  });
  await check('rollback rehearsal preserves v2 but A.2 resumes unsafe cross-clinic legacy writes', async () => {
    const v2=await legacy.query('SELECT * FROM efriends_sync_ledger_v2 ORDER BY clinic_id,record_key');
    for(const clinic of ['clinic-A','clinic-B']) await legacy.rpc(mark(clinic,'rollback-only','synced','audit'));
    const rows=await legacy.query("SELECT * FROM efriends_sync_ledger WHERE external_id='rollback-only'");
    assert.equal(rows.length,1);assert.equal(rows[0].clinic_id,'clinic-A');assert.equal(rows[0].carestep_id,'clinic-B-patient');
    assert.deepEqual(await legacy.query('SELECT * FROM efriends_sync_ledger_v2 ORDER BY clinic_id,record_key'),v2);
  });
  await check('runtime outbound deny guard is active; tested business paths made zero external requests', async () => {
    assert.equal(blockedEgress,0);assert.equal((await fresh.rpc({op:'probe-egress'})).value,403);assert.equal(blockedEgress,1);
  });
} finally { await Promise.all(instances.map(mf=>mf.dispose())); }
console.log(JSON.stringify({ environment:'Miniflare local workerd D1; two separate nonpersistent DBs; synthetic data only', miniflare:JSON.parse(readFileSync(new URL('./node_modules/miniflare/package.json',import.meta.url))).version, workerSha256:hash(worker), auditSha256:hash(audit), mainRef, blockedEgress, results, passed:results.filter(x=>x.pass).length, failed:results.filter(x=>!x.pass).length },null,2));
if(results.some(x=>!x.pass)) process.exitCode=1;
