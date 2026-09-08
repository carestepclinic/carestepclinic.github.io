from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / 'worker.txt'
REVIEW = ROOT / 'tools' / 'review-worker-candidate.mjs'
SHA_FILE = ROOT / 'tools' / 'worker-a2-1.sha256'
DOC = ROOT / 'docs' / 'worker-a2-1-corrective-hotfix.md'
A2_SHA = '9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7'
TARGET = '10.7-A.2.1'


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

raw = WORKER.read_bytes()
actual = hashlib.sha256(raw).hexdigest()
text = raw.decode('utf-8')

if actual != A2_SHA:
    if all(f"const {name}='{TARGET}';" in text for name in ['CARESTEP_VERSION', 'CARESTEP_BUILD', 'EFSYNC_VERSION']):
        print('worker.txt is already an A.2.1 candidate; no patch reapplied')
        raise SystemExit(0)
    raise SystemExit(f'worker.txt is not the pinned A.2 source: {actual}')

text = replace_once(text, "const CARESTEP_VERSION='10.7-A.2';", f"const CARESTEP_VERSION='{TARGET}';", 'CARESTEP_VERSION')
text = replace_once(text, "const CARESTEP_BUILD='10.7-A.2';", f"const CARESTEP_BUILD='{TARGET}';", 'CARESTEP_BUILD')
text = replace_once(text, "const EFSYNC_VERSION='10.7-A.2';", f"const EFSYNC_VERSION='{TARGET}';", 'EFSYNC_VERSION')

# P1-2: make schema bootstrap safe for both a truly fresh DB and an old DB.
# All CREATE TABLE statements are materialized first so triggers/indexes cannot
# reference tables that appear later in SAAS_SCHEMA_STATEMENTS. The consult
# index is deferred further because old care_home_followups needs ALTERs first.
old_bootstrap = "  await env.DB.batch(SAAS_SCHEMA_STATEMENTS.map(x=>env.DB.prepare(x)));"
new_bootstrap = "  const saasTableStatements=SAAS_SCHEMA_STATEMENTS.filter(x=>/^\\s*CREATE TABLE IF NOT EXISTS /i.test(x));\n  const saasPostTableStatements=SAAS_SCHEMA_STATEMENTS.filter(x=>!/^\\s*CREATE TABLE IF NOT EXISTS /i.test(x)&&!x.includes('CREATE INDEX IF NOT EXISTS idx_care_home_followups_consult_status'));\n  await env.DB.batch([...saasTableStatements,...saasPostTableStatements].map(x=>env.DB.prepare(x)));"
text = replace_once(text, old_bootstrap, new_bootstrap, 'ordered schema bootstrap')

# P1-1: preserve the deployed v1 ledger for audit/backward evidence, but move all
# A.2.1 runtime state to an additive clinic-scoped v2 ledger.
ledger_index = "    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_efsync_ledger_clinic_status ON efriends_sync_ledger(clinic_id,status,last_seen_at DESC)`),"
ledger_v2 = ledger_index + "\n    env.DB.prepare(`CREATE TABLE IF NOT EXISTS efriends_sync_ledger_v2(\n      clinic_id TEXT NOT NULL,record_key TEXT NOT NULL,entity_kind TEXT NOT NULL,external_id TEXT DEFAULT '',source_ref TEXT DEFAULT '',\n      carestep_id TEXT DEFAULT '',source_hash TEXT DEFAULT '',status TEXT NOT NULL DEFAULT 'seen',run_id TEXT DEFAULT '',\n      last_seen_at TEXT NOT NULL,last_success_at TEXT DEFAULT '',last_error TEXT DEFAULT '',\n      PRIMARY KEY(clinic_id,record_key))`),\n    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_efsync_ledger_v2_clinic_status ON efriends_sync_ledger_v2(clinic_id,status,last_seen_at DESC)`),"
text = replace_once(text, ledger_index, ledger_v2, 'ledger v2 schema')

migration_anchor = "  ]);\n  const patientCols=await env.DB.prepare('PRAGMA table_info(care_patients)').all(),patientNames=new Set((patientCols.results||[]).map(x=>x.name));"
migration = "  ]);\n  await env.DB.prepare(`INSERT OR IGNORE INTO efriends_sync_ledger_v2(clinic_id,record_key,entity_kind,external_id,source_ref,carestep_id,source_hash,status,run_id,last_seen_at,last_success_at,last_error)\n    SELECT clinic_id,record_key,entity_kind,external_id,source_ref,carestep_id,source_hash,status,run_id,last_seen_at,last_success_at,last_error FROM efriends_sync_ledger`).run();\n  const patientCols=await env.DB.prepare('PRAGMA table_info(care_patients)').all(),patientNames=new Set((patientCols.results||[]).map(x=>x.name));"
text = replace_once(text, migration_anchor, migration, 'ledger additive migration')

ledger_fn_re = re.compile(r"async function efSyncLedgerMark\(env,cid,kind,row,status,now,carestepId='',runId='',error=''\)\{.*?\n\}\nasync function efSyncQuarantineRow", re.S)
match = ledger_fn_re.search(text)
if not match:
    raise SystemExit('efSyncLedgerMark function not found')
new_ledger_fn = """async function efSyncLedgerMark(env,cid,kind,row,status,now,carestepId='',runId='',error=''){
  const externalId=clean(row.externalGuardianId||row.external_guardian_id||row.externalPatientId||row.external_patient_id||row.externalId||'',120),sourceRef=clean(row.sourceRef||row.source_ref||'',240),sourceHash=clean(row.sourceHash||row.source_hash||'',100),key=efSyncRecordKey(kind,row);
  await env.DB.prepare(`INSERT INTO efriends_sync_ledger_v2(clinic_id,record_key,entity_kind,external_id,source_ref,carestep_id,source_hash,status,run_id,last_seen_at,last_success_at,last_error) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12) ON CONFLICT(clinic_id,record_key) DO UPDATE SET carestep_id=excluded.carestep_id,source_hash=excluded.source_hash,status=excluded.status,run_id=excluded.run_id,last_seen_at=excluded.last_seen_at,last_success_at=CASE WHEN excluded.status='synced' THEN excluded.last_success_at ELSE efriends_sync_ledger_v2.last_success_at END,last_error=excluded.last_error`).bind(cid,key,kind,externalId,sourceRef,clean(carestepId,180),sourceHash,status,clean(runId,180),now,status==='synced'?now:'',clean(error,500)).run();
}
async function efSyncQuarantineRow"""
text = text[:match.start()] + new_ledger_fn + text[match.end():]

old_status_read = "SELECT last_seen_at FROM efriends_sync_ledger WHERE clinic_id=?1 ORDER BY last_seen_at DESC LIMIT 1"
new_status_read = "SELECT last_seen_at FROM efriends_sync_ledger_v2 WHERE clinic_id=?1 ORDER BY last_seen_at DESC LIMIT 1"
text = replace_once(text, old_status_read, new_status_read, 'ledger status read')

WORKER.write_bytes(text.encode('utf-8'))
new_sha = hashlib.sha256(WORKER.read_bytes()).hexdigest()
if new_sha == A2_SHA:
    raise SystemExit('corrective worker unexpectedly retained the A.2 hash')
SHA_FILE.write_text(new_sha + '\n', encoding='utf-8')

review = REVIEW.read_text(encoding='utf-8')
base_line = "const baseRef = '26395b304c94ea40a016c44b2e815da828e91c75';"
review = replace_once(review, base_line, "const correctiveMode = process.env.CARESTEP_REVIEW_MODE === 'corrective';\nconst expectedVersion = correctiveMode ? '10.7-A.2.1' : '10.7-A.2';\n" + base_line, 'review mode')
identity_re = re.compile(r"await check\('exact raw SHA-256 and component versions', \(\) => \{.*?\n\}\);", re.S)
identity = identity_re.search(review)
if not identity:
    raise SystemExit('review identity check not found')
identity_new = """await check(correctiveMode ? 'corrective SHA differs from A.2 and component versions are A.2.1' : 'exact raw SHA-256 and component versions', () => {
  const actualSha = createHash('sha256').update(bytes).digest('hex');
  if (correctiveMode) assert.notEqual(actualSha, EXPECTED_WORKER_SHA256); else assert.equal(actualSha, EXPECTED_WORKER_SHA256);
  const escapedVersion = expectedVersion.replace(/\\./g, '\\\\.');
  for (const name of ['CARESTEP_VERSION', 'CARESTEP_BUILD', 'EFSYNC_VERSION']) assert.match(source, new RegExp(`const ${name}='${escapedVersion}'`));
});"""
review = review[:identity.start()] + identity_new + review[identity.end():]
review = replace_once(review, "  assert.equal(body.version, '10.7-A.2');", "  assert.equal(body.version, expectedVersion);", 'health expected version')
review = replace_once(review, "    const rows = sql.prepare('SELECT clinic_id,carestep_id FROM efriends_sync_ledger ORDER BY clinic_id').all();", "    const ledgerTable = correctiveMode ? 'efriends_sync_ledger_v2' : 'efriends_sync_ledger';\n    const rows = sql.prepare(`SELECT clinic_id,carestep_id FROM ${ledgerTable} ORDER BY clinic_id`).all();", 'ledger isolation table')

extra_anchor = "console.log(JSON.stringify({ baseRef, sha256: createHash('sha256').update(bytes).digest('hex'), namedFunctions: { before: names(base).length, after: names(source).length, changed: changed.length, unchanged: names(base).length - changed.length }, results, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length }, null, 2));"
extra_checks = r"""if (correctiveMode) {
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
""" + extra_anchor
review = replace_once(review, extra_anchor, extra_checks, 'corrective review checks')
REVIEW.write_text(review, encoding='utf-8')

DOC.write_text(f"""# CARESTEP Worker v{TARGET} corrective P1 hotfix

This branch is a corrective candidate derived from the verified deployed A.2 source.
It is **not** the exact A.2 artifact and must never reuse the A.2 SHA-256 label.

## Source and target

- Base audit source: `incoming/worker-v10.7-A.2.txt`
- Base A.2 SHA-256: `{A2_SHA}`
- Target Worker version: `{TARGET}`
- Candidate SHA-256: `{new_sha}`

## P1-1 — eFriends Sync Ledger clinic isolation

The deployed A.2 table `efriends_sync_ledger` is preserved unchanged for audit/backward evidence.
A new additive `efriends_sync_ledger_v2` table uses `PRIMARY KEY(clinic_id,record_key)`.
On schema initialization A.2.1 copies existing v1 rows with `INSERT OR IGNORE ... SELECT`; it does not delete,
rewrite, or rename existing v1 rows. A.2.1 runtime reads/writes use v2 only. This prevents identical
external IDs/sourceRefs in different clinics from sharing one ledger row.

Rollback note: the v1 table remains intact, but A.2 code will not see ledger state written only to v2 after
an A.2.1 rollout. Ledger is operational sync metadata; patient/guardian/event data is not migrated by this hotfix.

## P1-2 — schema initialization and existing-schema upgrade ordering

`ensureSaasDb` now materializes all `CREATE TABLE IF NOT EXISTS` statements before indexes/triggers so a fresh
D1 does not depend on incidental statement ordering. `idx_care_home_followups_consult_status` is additionally
excluded from the initial non-table batch. The function then inspects and ALTERs `care_home_followups` to
guarantee `consult_status` and `consult_updated_at`, and only then creates the dependent index in the existing
post-ALTER index batch. Fresh databases and main-era upgrade databases therefore converge on the same final
schema without a destructive migration.

## Safety

No DROP, production D1 migration execution, FullReconcile, Windows Agent change, or production data write is
part of this branch. Production deployment remains blocked pending review and explicit approval.
""", encoding='utf-8')

print(f'patched worker to {TARGET}')
print(f'candidate_sha256={new_sha}')
