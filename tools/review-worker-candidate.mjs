// Offline regression gate. Never contacts Cloudflare or opens a production database.
// Node 24: node --experimental-vm-modules tools/review-worker-candidate.mjs <candidate>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { EXPECTED_WORKER_SHA256, EXPECTED_A2_SHA256 } from './verify-worker-source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.argv[2]) throw new Error('Supply the candidate Worker path; worker.txt is never replaced by this tool.');
const bytes = readFileSync(resolve(process.argv[2]));
const source = bytes.toString('utf8');
const auditBytes = readFileSync(new URL('../incoming/worker-v10.7-A.2.txt', import.meta.url));
const auditSource = auditBytes.toString('utf8').replace(/\r\n/g, '\n');
const targetVersion = '10.7-A.2.1';
const baseRef = '26395b304c94ea40a016c44b2e815da828e91c75';
const base = execFileSync(process.env.CARESTEP_GIT || 'git', ['show', `${baseRef}:worker.txt`], { cwd: root, encoding: 'utf8', maxBuffer: 5e6 });
const names = text => [...new Set([...text.matchAll(/^(?:async )?function\s+(\w+)\s*\(/gm)].map(m => m[1]))];
async function load(text) {
  const context = vm.createContext({ TextEncoder, TextDecoder, URL, URLSearchParams, Request, Response, Headers, atob, btoa, crypto: webcrypto, console: { log() {}, warn() {}, error() {} } });
  const module = new vm.SourceTextModule(`${text}\nexport {${names(text).join(',')},SAAS_SCHEMA_STATEMENTS};`, { context });
  await module.link(() => { throw new Error('Imports are not allowed in this offline fixture'); });
  await module.evaluate({ timeout: 2000 });
  return module.namespace;
}
function database() {
  const sql = new DatabaseSync(':memory:');
  const DB = {
    prepare(query) {
      let values = [];
      const execute = method => {
        const args = [];
        const translated = query.replace(/\?(\d+)/g, (_, index) => { args.push(values[Number(index) - 1]); return '?'; });
        return sql.prepare(translated)[method](...args);
      };
      return {
        bind(...args) { values = args; return this; },
        async run() { const result = execute('run'); return { meta: { changes: Number(result.changes) } }; },
        async all() { return { results: execute('all') }; },
        async first() { return execute('get') || null; }
      };
    },
    async batch(statements) { const out = []; for (const statement of statements) out.push(await statement.run()); return out; }
  };
  return { sql, DB };
}
async function fixture() {
  const api = await load(source);
  const { sql, DB } = database();
  sql.exec('CREATE TABLE care_patients(id TEXT, clinic_id TEXT, active INTEGER, updated_at TEXT)');
  sql.exec('CREATE TABLE care_patient_events(clinic_id TEXT, event_type TEXT, source_ref TEXT)');
  const env = { DB, EFRIENDS_SYNC_CLINIC_ID: 'clinic-A', CARESTEP_PATIENT_DATA_KEY: 'offline-fixture-key-never-used-in-production' };
  await api.efSyncEnsureSchema(env);
  return { api, sql, env };
}
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.message }); }
}
await check('independent A.2 audit hash and corrective source/version identities', () => {
  assert.equal(createHash('sha256').update(auditSource).digest('hex'), EXPECTED_A2_SHA256);
  assert.equal(createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex'), EXPECTED_WORKER_SHA256);
  for (const name of ['CARESTEP_VERSION', 'CARESTEP_BUILD', 'EFSYNC_VERSION']) assert.ok(source.includes(`const ${name}='${targetVersion}';`));
});
const baseline = await load(base);
const candidate = await load(source);
const audit = await load(auditSource);
await check('only the three P1 ledger functions differ from exact A.2', () => {
  const changedFromA2 = names(auditSource).filter(name => !candidate[name] || audit[name].toString() !== candidate[name].toString().replace(/\r\n/g, '\n'));
  assert.deepEqual(changedFromA2.sort(), ['efSyncEnsureSchema', 'efSyncLedgerMark', 'saasEmrSyncStatus'].sort());
  assert.deepEqual(names(source).sort(), names(auditSource).sort());
});
await check('all main and A.2 schema table declarations retained', () => {
  const tables = text => new Set([...text.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(m => m[1]));
  const current = tables(source);
  assert.deepEqual([...tables(base), ...tables(auditSource)].filter(name => !current.has(name)), []);
});
await check('all existing named functions retained', () => {
  const missing = names(base).filter(name => typeof candidate[name] !== 'function');
  assert.deepEqual(missing, []);
});
const changed = names(base).filter(name => candidate[name] && baseline[name].toString().replace(/\r\n/g, '\n') !== candidate[name].toString().replace(/\r\n/g, '\n'));
await check('core payment, OAuth, Kakao, password and encryption implementations unchanged', () => {
  const reviewedChanges = new Set(['hqAuthorized', 'hqSubscriptions']);
  const critical = names(base).filter(name => /toss|solapi|bill|subscription|auth|encrypt|decrypt|password|session|patientData/i.test(name));
  assert.deepEqual(critical.filter(name => changed.includes(name) && !reviewedChanges.has(name)), []);
});
await check('existing literal routes retained', () => {
  const routes = text => [...new Set([...text.matchAll(/url\.pathname\s*===\s*['"]([^'"]+)['"]/g)].map(m => m[1]))];
  assert.deepEqual(routes(base).filter(route => !routes(source).includes(route)), []);
});
await check('health rejects missing auth; valid auth returns corrective version', async () => {
  const env = { DB: {}, EFRIENDS_SYNC_API_KEY: 'offline-fixture-auth-key-123456789', EFRIENDS_SYNC_CLINIC_ID: 'clinic-A' };
  const url = 'https://offline.invalid/efriends/v1/health';
  assert.equal((await candidate.handleEfriendsSyncRequest(new Request(url), env)).status, 401);
  const response = await candidate.handleEfriendsSyncRequest(new Request(url, { headers: { Authorization: `Bearer ${env.EFRIENDS_SYNC_API_KEY}` } }), env);
  const body = await response.json();
  assert.equal(body.version, targetVersion);
  assert.equal(body.db, true); // Binding-presence check only, not proof of D1 connectivity.
});
await check('HQ master auth retained and missing credentials rejected', async () => {
  assert.equal(await candidate.hqAuthorized(new Request('https://offline.invalid'), {}), false);
  const env = { CARESTEP_HQ_KEY: 'offline-master-key-123456789012345' };
  assert.equal(await candidate.hqAuthorized(new Request('https://offline.invalid', { headers: { 'X-CARESTEP-HQ-KEY': env.CARESTEP_HQ_KEY } }), env), true);
});
await check('reconcile prefers eligible counts, separates extras and scopes clinic', async () => {
  const { api, sql, env } = await fixture();
  try {
    sql.exec("INSERT INTO care_patient_events VALUES('clinic-A','vaccination','efriends:one'),('clinic-A','visit','efriends:history'),('clinic-B','vaccination','efriends:foreign')");
    const request = counts => new Request('https://offline.invalid/efriends/v1/reconcile', { method: 'POST', body: JSON.stringify({ counts }) });
    const ok = await api.efSyncReconcile(request({ sourceVaccinations: 99, sourceEligibleVaccinations: 1, sourceEligibleVisits: 0 }), env);
    assert.equal(ok.status, 'ok'); assert.equal(ok.differences, 0); assert.equal(ok.extras.visits, -1); assert.equal(ok.carestep.vaccinations, 1);
    const missing = await api.efSyncReconcile(request({ sourceEligibleVaccinations: 2 }), env);
    assert.equal(missing.status, 'attention'); assert.equal(missing.missing.vaccinations, 1);
  } finally { sql.close(); }
});
await check('checkpoint does not move backward and isolates clinics', async () => {
  const { api, sql, env } = await fixture();
  try {
    for (const [clinic, cursor] of [['clinic-A', 10], ['clinic-A', 2], ['clinic-B', 3]]) {
      const request = new Request('https://offline.invalid', { method: 'POST', body: JSON.stringify({ agentId: 'agent', snapshotId: 'snapshot', kind: 'events', cursor, total: 20 }) });
      await api.efSyncCheckpointSave(request, { ...env, EFRIENDS_SYNC_CLINIC_ID: clinic });
    }
    assert.equal(sql.prepare("SELECT cursor FROM efriends_sync_checkpoints WHERE clinic_id='clinic-A'").get().cursor, 10);
    assert.equal(sql.prepare("SELECT cursor FROM efriends_sync_checkpoints WHERE clinic_id='clinic-B'").get().cursor, 3);
  } finally { sql.close(); }
});
await check('shared phone matches quarantine without guardian mapping', async () => {
  const { api, sql, env } = await fixture();
  try {
    sql.exec('CREATE TABLE care_guardians(id TEXT, clinic_id TEXT, name_cipher TEXT, phone_hash TEXT, updated_at TEXT)');
    const row = { externalGuardianId: 'source-guardian', name: 'Fixture Guardian', phone: '01000000000' };
    const hash = await api.patientBlindHash(env, row.phone);
    const cipher = await api.patientDataEncrypt(env, row.name);
    for (const id of ['guardian-one', 'guardian-two']) sql.prepare('INSERT INTO care_guardians VALUES(?,?,?,?,?)').run(id, 'clinic-A', cipher, hash, '2026-09-08');
    await assert.rejects(api.efSyncUpsertGuardian(env, 'clinic-A', row, '2026-09-08T00:00:00Z'), error => error.syncDisposition === 'quarantine');
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM efriends_sync_guardian_map').get().n, 0);
    assert.equal(sql.prepare("SELECT COUNT(*) n FROM efriends_sync_quarantine WHERE clinic_id='clinic-A' AND status='pending'").get().n, 1);
  } finally { sql.close(); }
});
await check('documented A.2 behavior: third failure enters dead letter', async () => {
  const { api, sql, env } = await fixture();
  try {
    const statuses = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await api.efSyncRecordFailure(env, 'clinic-A', 'patient', { externalPatientId: 'fixture-id' }, new Error('fixture failure'), '2026-09-08T00:00:00Z');
      statuses.push(result.status);
    }
    assert.deepEqual(statuses, ['retry', 'retry', 'dead_letter']);
    assert.equal(sql.prepare('SELECT attempt_count FROM efriends_sync_failures').get().attempt_count, 3);
  } finally { sql.close(); }
});
await check('ledger isolates the same external ID across two clinics', async () => {
  const { api, sql, env } = await fixture();
  try {
    for (let repeat = 0; repeat < 2; repeat++) for (const clinic of ['clinic-A', 'clinic-B']) await api.efSyncLedgerMark(env, clinic, 'event', { externalPatientId: 'same-id', sourceRef: 'efriends:same-ref' }, clinic === 'clinic-A' ? 'synced' : 'retry', '2026-09-08T00:00:00Z', `${clinic}-patient`, `${clinic}-run`);
    const rows = sql.prepare('SELECT clinic_id,carestep_id,run_id,status FROM efriends_sync_ledger_v2 ORDER BY clinic_id').all();
    assert.equal(rows.length, 2, `Expected two isolated rows; actual ${JSON.stringify(rows)}`);
    assert.equal(rows[0].carestep_id, 'clinic-A-patient');
    assert.equal(rows[0].run_id, 'clinic-A-run'); assert.equal(rows[0].status, 'synced');
    assert.equal(rows[1].carestep_id, 'clinic-B-patient');
    assert.equal(rows[1].run_id, 'clinic-B-run'); assert.equal(rows[1].status, 'retry');
    await api.efSyncLedgerMark(env, 'clinic-A', 'event', { externalPatientId: 'same-id', sourceRef: 'efriends:same-ref' }, 'dead_letter', '2026-09-08T01:00:00Z', 'clinic-A-patient', 'clinic-A-next-run');
    assert.deepEqual(sql.prepare("SELECT clinic_id,carestep_id,run_id,status FROM efriends_sync_ledger_v2 WHERE clinic_id='clinic-B'").get(), rows[1]);
    assert.equal(sql.prepare("SELECT last_success_at FROM efriends_sync_ledger_v2 WHERE clinic_id='clinic-A'").get().last_success_at, '2026-09-08T00:00:00Z');
  } finally { sql.close(); }
});
await check('legacy A.2 rows remain byte-for-byte unchanged through repeat initialization and writes', async () => {
  const { sql, DB } = database();
  try {
    sql.exec('CREATE TABLE care_patients(id TEXT, clinic_id TEXT, active INTEGER, updated_at TEXT)');
    const env = { DB };
    const legacy = await load(auditSource);
    await legacy.efSyncEnsureSchema(env);
    await legacy.efSyncLedgerMark(env, 'clinic-A', 'patient', { externalPatientId: 'legacy-id' }, 'synced', '2026-09-01T00:00:00Z', 'legacy-patient', 'legacy-run');
    const before = JSON.stringify(sql.prepare('SELECT * FROM efriends_sync_ledger').all());
    for (let repeat = 0; repeat < 2; repeat++) {
      const fresh = await load(source);
      await fresh.efSyncEnsureSchema(env);
      if (repeat === 0) assert.equal(sql.prepare('SELECT COUNT(*) n FROM efriends_sync_ledger_v2').get().n, 0);
      await fresh.efSyncLedgerMark(env, 'clinic-A', 'patient', { externalPatientId: 'legacy-id' }, 'synced', '2026-09-08T00:00:00Z', 'new-observation', 'new-run');
    }
    assert.equal(JSON.stringify(sql.prepare('SELECT * FROM efriends_sync_ledger').all()), before);
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM efriends_sync_ledger_v2').get().n, 1);
  } finally { sql.close(); }
});
await check('Sync Center ledger status reads only v2 and the requested clinic', async () => {
  const { api, sql, env } = await fixture();
  try {
    sql.exec("INSERT INTO efriends_sync_ledger(record_key,clinic_id,entity_kind,last_seen_at) VALUES('legacy','clinic-A','patient','2099-01-01')");
    for (const [clinic, seen] of [['clinic-A', '2026-09-08T00:00:00Z'], ['clinic-B', '2026-09-08T01:00:00Z']]) await api.efSyncLedgerMark(env, clinic, 'patient', { externalPatientId: 'same' }, 'synced', seen, clinic, clinic);
    const result = await api.saasEmrSyncStatus(env, { clinic_id: 'clinic-A', role: 'owner' });
    assert.equal(result.integrity.ledgerLastSeen, '2026-09-08T00:00:00Z');
    assert.doesNotMatch(source, /(?:FROM|INTO|UPDATE) efriends_sync_ledger\b/);
  } finally { sql.close(); }
});
await check('eFriends status, run start/finish and empty batch preserve clinic scope', async () => {
  const { api, sql, env } = await fixture();
  try {
    const headers = { Authorization: 'Bearer offline-fixture-auth-key-123456789', 'Content-Type': 'application/json' };
    env.EFRIENDS_SYNC_API_KEY = 'offline-fixture-auth-key-123456789';
    const request = (path, body) => new Request(`https://offline.invalid/efriends/v1/${path}`, { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const start = await api.handleEfriendsSyncRequest(request('runs', { agentId: 'agent', snapshotId: 'snapshot' }), env);
    assert.equal(start.status, 201); const { runId } = await start.json();
    const batch = await api.handleEfriendsSyncRequest(request('sync-batch', { runId, guardians: [], patients: [], events: [] }), env);
    assert.equal(batch.status, 200); assert.equal((await batch.json()).version, targetVersion);
    await api.handleEfriendsSyncRequest(request(`runs/${runId}/finish`, { status: 'completed', metrics: {} }), { ...env, EFRIENDS_SYNC_CLINIC_ID: 'clinic-B' });
    assert.equal(sql.prepare('SELECT status FROM efriends_sync_runs WHERE id=?').get(runId).status, 'running');
    await api.handleEfriendsSyncRequest(request(`runs/${runId}/finish`, { status: 'completed', metrics: {} }), env);
    const status = await (await api.handleEfriendsSyncRequest(request('status'), env)).json();
    assert.equal(status.clinicId, 'clinic-A'); assert.equal(status.lastRun.status, 'completed');
    assert.equal(status.queue.retry, 0); assert.equal(status.queue.deadLetter, 0);
  } finally { sql.close(); }
});
await check('fresh empty DB initializes with columns, dependent index and trigger', async () => {
  const { sql, DB } = database();
  try {
    const fresh = await load(source);
    await fresh.ensureSaasDb({ DB });
    const columns = sql.prepare('PRAGMA table_info(care_home_followups)').all().map(row => row.name);
    assert.ok(columns.includes('consult_status')); assert.ok(columns.includes('consult_updated_at'));
    assert.ok(sql.prepare("SELECT name FROM sqlite_master WHERE name='idx_care_home_followups_consult_status'").get());
    assert.ok(sql.prepare("SELECT name FROM sqlite_master WHERE name='trg_care_followup_cases_patient_delete'").get());
  } finally { sql.close(); }
});
await check('pinned main-era initializer succeeds before corrective upgrade', async () => {
  const { sql, DB } = database();
  try {
    const main = await load(base);
    await main.ensureSaasDb({ DB });
    assert.equal(sql.prepare('PRAGMA table_info(care_home_followups)').all().some(row => row.name === 'consult_status'), false);
    const fresh = await load(source);
    await fresh.ensureSaasDb({ DB });
    assert.ok(sql.prepare("SELECT name FROM sqlite_master WHERE name='idx_care_home_followups_consult_status'").get());
  } finally { sql.close(); }
});
await check('ensureSaasDb upgrades the main schema without an ordering error', async () => {
  const { sql, DB } = database();
  try {
    for (const statement of baseline.SAAS_SCHEMA_STATEMENTS) sql.exec(statement);
    const freshCandidate = await load(source);
    await freshCandidate.ensureSaasDb({ DB });
    const schemaBefore = JSON.stringify(sql.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all());
    const repeated = await load(source); // Cold isolate: do not let saasDbReady mask idempotency failures.
    await repeated.ensureSaasDb({ DB });
    assert.equal(JSON.stringify(sql.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()), schemaBefore);
  } finally { sql.close(); }
});
console.log(JSON.stringify({ baseRef, sha256: createHash('sha256').update(bytes).digest('hex'), namedFunctions: { before: names(base).length, after: names(source).length, changed: changed.length, unchanged: names(base).length - changed.length }, results, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length }, null, 2));
if (results.some(result => !result.pass)) process.exitCode = 1;
