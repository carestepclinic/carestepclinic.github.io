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
import { EXPECTED_WORKER_SHA256 } from './verify-worker-source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.argv[2]) throw new Error('Supply the candidate Worker path; worker.txt is never replaced by this tool.');
const bytes = readFileSync(resolve(process.argv[2]));
const source = bytes.toString('utf8');
const correctiveMode = process.env.CARESTEP_REVIEW_MODE === 'corrective';
const expectedVersion = correctiveMode ? '10.7-A.2.1' : '10.7-A.2';
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
await check(correctiveMode ? 'corrective SHA differs from A.2 and component versions are A.2.1' : 'exact raw SHA-256 and component versions', () => {
  const actualSha = createHash('sha256').update(bytes).digest('hex');
  if (correctiveMode) assert.notEqual(actualSha, EXPECTED_WORKER_SHA256); else assert.equal(actualSha, EXPECTED_WORKER_SHA256);
  const escapedVersion = expectedVersion.replace(/\./g, '\\.');
  for (const name of ['CARESTEP_VERSION', 'CARESTEP_BUILD', 'EFSYNC_VERSION']) assert.match(source, new RegExp(`const ${name}='${escapedVersion}'`));
});
const baseline = await load(base);
const candidate = await load(source);
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
await check('health rejects missing auth; valid auth returns A.2', async () => {
  const env = { DB: {}, EFRIENDS_SYNC_API_KEY: 'offline-fixture-auth-key-123456789', EFRIENDS_SYNC_CLINIC_ID: 'clinic-A' };
  const url = 'https://offline.invalid/efriends/v1/health';
  assert.equal((await candidate.handleEfriendsSyncRequest(new Request(url), env)).status, 401);
  const response = await candidate.handleEfriendsSyncRequest(new Request(url, { headers: { Authorization: `Bearer ${env.EFRIENDS_SYNC_API_KEY}` } }), env);
  const body = await response.json();
  assert.equal(body.version, expectedVersion);
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
    for (const clinic of ['clinic-A', 'clinic-B']) await api.efSyncLedgerMark(env, clinic, 'patient', { externalPatientId: 'same-id' }, 'synced', '2026-09-08T00:00:00Z', `${clinic}-patient`, `${clinic}-run`);
    const ledgerTable = correctiveMode ? 'efriends_sync_ledger_v2' : 'efriends_sync_ledger';
    const rows = sql.prepare(`SELECT clinic_id,carestep_id FROM ${ledgerTable} ORDER BY clinic_id`).all();
    assert.equal(rows.length, 2, `Expected two isolated rows; actual ${JSON.stringify(rows)}`);
    assert.equal(rows[0].carestep_id, 'clinic-A-patient');
  } finally { sql.close(); }
});
await check('ensureSaasDb upgrades the main schema without an ordering error', async () => {
  const { sql, DB } = database();
  try {
    for (const statement of baseline.SAAS_SCHEMA_STATEMENTS) sql.exec(statement);
    const freshCandidate = await load(source);
    await freshCandidate.ensureSaasDb({ DB });
  } finally { sql.close(); }
});
if (correctiveMode) {
  await check('fresh schema initialization creates consult columns and dependent index', async () => {
    const { sql, DB } = database();
    try {
      const freshCandidate = await load(source);
      await freshCandidate.ensureSaasDb({ DB });
      const cols = sql.prepare("PRAGMA table_info(care_home_followups)").all().map(x => x.name);
      assert.ok(cols.includes('consult_status'));
      assert.ok(cols.includes('consult_updated_at'));
      assert.equal(sql.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='index' AND name='idx_care_home_followups_consult_status'").get().n, 1);
    } finally { sql.close(); }
  });
  await check('legacy ledger rows migrate additively and remain preserved', async () => {
    const api = await load(source);
    const { sql, DB } = database();
    try {
      sql.exec('CREATE TABLE care_patients(id TEXT, clinic_id TEXT, active INTEGER, updated_at TEXT)');
      sql.exec('CREATE TABLE care_patient_events(clinic_id TEXT, event_type TEXT, source_ref TEXT)');
      sql.exec("CREATE TABLE efriends_sync_ledger(record_key TEXT PRIMARY KEY,clinic_id TEXT NOT NULL,entity_kind TEXT NOT NULL,external_id TEXT DEFAULT '',source_ref TEXT DEFAULT '',carestep_id TEXT DEFAULT '',source_hash TEXT DEFAULT '',status TEXT NOT NULL DEFAULT 'seen',run_id TEXT DEFAULT '',last_seen_at TEXT NOT NULL,last_success_at TEXT DEFAULT '',last_error TEXT DEFAULT '')");
      sql.exec("INSERT INTO efriends_sync_ledger VALUES('patient:same-id:','clinic-A','patient','same-id','','clinic-A-patient','','synced','clinic-A-run','2026-09-08T00:00:00Z','2026-09-08T00:00:00Z','')");
      const env = { DB, EFRIENDS_SYNC_CLINIC_ID: 'clinic-A', CARESTEP_PATIENT_DATA_KEY: 'offline-fixture-key-never-used-in-production' };
      await api.efSyncEnsureSchema(env);
      assert.equal(sql.prepare('SELECT COUNT(*) n FROM efriends_sync_ledger').get().n, 1);
      const copied = sql.prepare("SELECT clinic_id,carestep_id FROM efriends_sync_ledger_v2 WHERE clinic_id='clinic-A'").get();
      assert.equal(copied.carestep_id, 'clinic-A-patient');
      await api.efSyncLedgerMark(env, 'clinic-B', 'patient', { externalPatientId: 'same-id' }, 'synced', '2026-09-08T00:01:00Z', 'clinic-B-patient', 'clinic-B-run');
      const rows = sql.prepare('SELECT clinic_id,carestep_id FROM efriends_sync_ledger_v2 ORDER BY clinic_id').all();
      assert.equal(rows.length, 2);
      assert.equal(rows[0].carestep_id, 'clinic-A-patient');
      assert.equal(rows[1].carestep_id, 'clinic-B-patient');
      assert.equal(sql.prepare('SELECT COUNT(*) n FROM efriends_sync_ledger').get().n, 1);
    } finally { sql.close(); }
  });
}
console.log(JSON.stringify({ baseRef, sha256: createHash('sha256').update(bytes).digest('hex'), namedFunctions: { before: names(base).length, after: names(source).length, changed: changed.length, unchanged: names(base).length - changed.length }, results, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length }, null, 2));
if (results.some(result => !result.pass)) process.exitCode = 1;
