# Production source audit — 2026-09-08

## Status: blocked on exact Worker source

This branch starts from fetched `origin/main` at
`26395b304c94ea40a016c44b2e815da828e91c75`. It preserves all existing application
files. It has **not synchronized worker.txt to production** and must remain a
draft until the missing source and subsequent reviews are complete. Issue #3
remains open: <https://github.com/carestepclinic/carestepclinic.github.io/issues/3>.

## Production baseline (reported, not queried by this audit)

| Component | Version | Evidence |
| --- | --- | --- |
| Clinic UI | 10.7-A | User handoff, Issue #3, main UI labels |
| Cloudflare Worker | 10.7-A.2 | User handoff and Issue #3; health reported ok=true, db=true |
| Windows Agent | 10.7-A.4 | User handoff, Issue #3, archive HOTFIX_A4.md |

Agent path: `C:\CARESTEP_eFriends_Sync\CARESTEP_eFriends_Sync_Agent_v10_7_A.ps1`.
Task: `CARESTEP eFriends Sync`, enabled under SYSTEM every 15 minutes, last
result 0. The audit does not access or change that server. eFriends remains
read-only. Agent versions are independent of Worker/UI versions.

Reported reconcile: status=ok, differences=0, missing=0.

| Category | Effective source | CARESTEP | Historical extra (source minus CARESTEP) |
| --- | ---: | ---: | ---: |
| guardians | 2319 | 2319 | 0 |
| patients | 2843 | 2846 | -3 |
| weights | 11823 | 11823 | 0 |
| visits | 13 | 10176 | -10163 |
| vaccinations | 6256 | 6256 | 0 |
| heartworm | 5465 | 5465 | 0 |

Positive differences are missing candidates; negative differences are retained
history. Vaccination eligibility is **unique sourceRef**, not the 6268 eligible
CSV rows (12 duplicate rows). Inactive-patient and event eligibility filters
must match Agent sync scope. FullReconcile is not needed.

## Repository inventory and conflicts

- `index.html`: Clinic v10.7-A, Sync Center and workspace integration. Historical
  v10.6-A references also remain; no blanket version replacement is appropriate.
- `patient-crm.js`, `patient-crm.css`, `patient-timeline.js`, `patient-breeds.js`:
  patient workspace, timeline and display assets. Timeline retains its v10.6-C
  source label; this is not the overall Clinic release version.
- `home.html`, `carestep-home.js`, corresponding CSS/icons, `sw.js`,
  `manifest.webmanifest`, `date-input-guard.js`: existing Home/browser assets.
- `tools/efriends-staging-import.js`, `tools/efriends-staging-loader-v1-1.js`:
  existing staging/import utilities; not run against production.
- `worker.txt`: both CARESTEP_VERSION (line 8) and EFSYNC_VERSION (line 4155)
  are 10.5-A. Reconcile, safety ledger, quarantine, dead letter and checkpoint
  behavior expected by the current UI/Agent are not present in this old block.
- No tracked package manifest, CI workflow, Wrangler configuration, separate
  D1 migration directory, Agent PS1, AGENTS.md, or `.openai/hosting.json` exists
  in the audited main tree. Schema is embedded in the Worker.
- The three old HOTFIX README files prescribe full Worker replacement using
  historical packages. The new root README supersedes those deployment steps.

## Source recovery evidence

Fetched all origin branches. Audited 112 reachable commits, including
`feature/efriends-sync-v10.5-a` and `feature/v10.7-a-data-integrity`. The latter
is an evidence source only; it is not the branch base and PR #2 is not merged.

Archive tip: `644a29ba2b40bf19b723c35f7bb0b7313b4e2bc1`.

| Artifact at archive tip | Parts | Strict base64/gzip recovery |
| --- | ---: | --- |
| worker.patch.gz.b64.part-00 through part-12 | 13 | Noncanonical concatenated base64; permissive decode then gunzip: unexpected end of file |
| final/worker.part-00 | 1 | gunzip: unexpected end of file |
| newfiles.tar.gz.b64.part-00 | 1 | gunzip: unexpected end of file |

Paths above are under `staging/v10.7-a/`. Parts were ordered by filename and
decoded in memory. Initial patch part-06 has 12241 characters and its tail
duplicates part-04's tail; the stream cannot be certified by concatenation.
No speculative reordering or partial output was applied or executed. Historical
part-13, deleted by `60e2f3d`, is the exact same Git blob as part-10
(`fb0e4b21b2df8542d75cc82ee3d711895f6275e0`), not a missing tail.

Only three distinct `worker.txt` blobs occur in reachable history. Their SHA-256:

- `75c4b9603a1151b0d10b7e5d97e0f795c1ec31f9b76fc630112bc114437e7d7c`
  (main Git blob, v10.5-A; matches FINALIZATION.md patch base).
- `29de1f69586e946fdc76a2b5609ac00c22b9e168affb465ead209716c0bd2090`
  (another v10.5-A source).
- `fb4a7bc5fda7bd33ce7ebc520bf81c4fe5b74b9bc44f973c52e69495fbf2ac14`
  (older source).

None matches the A.2 Worker hash recorded in `f02764b` / HOTFIX_A2.md:
`9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7`.
The GitHub releases API returned no releases. Issue #3 and PR #2 discussion
confirm runtime versions but provide no complete A.2 source attachment.

FINALIZATION.md's Worker hash `4eb57cb9432e10dc1c1fccf7eaac44cbb8fe69cf5cc340c31619792cf805a129`
belongs to **10.7-A**, not A.2. Do not treat that as the target hash.
HOTFIX_A4.md records Agent SHA-256
`0089820ab80ed75d5767820f23dae524980c4bd0810fc73dbf26e5e1633492ba`;
the Agent binary/source was not independently verified in this audit.

## Worker route and D1 review: existing 10.5-A only

| Endpoint | Existing source observation |
| --- | --- |
| GET /efriends/v1/health | Auth and DB-binding presence check; db=true does not execute a DB query |
| GET /efriends/v1/status | Three clinic-scoped COUNT subqueries, latest run LIMIT 1 |
| POST /efriends/v1/runs | Inserts clinic_id from configured EFRIENDS_SYNC_CLINIC_ID |
| POST /efriends/v1/runs/{id}/finish | UPDATE binds both run id and clinic_id |
| POST /efriends/v1/sync-batch | Bounded 100 guardians / 100 patients / 1200 events; multiple reads/writes per row |
| /efriends/v1/reconcile | Absent; cannot review target reconcile queries without A.2 source |

The old eFriends SELECT/UPDATE queries reviewed bind clinic scope; inserts and
map conflict keys include clinic_id. No confirmed cross-clinic query defect was
found in that old block. This is not certification of the unavailable A.2 SQL.
`care_patient_event_home` upserts conflict on globally unique event_id; verify
that invariant and clinic scope when reviewing the recovered target source.

COUNT queries read a clinic's map/index range each status call; they are not
constant-cost counters. Existing composite primary keys and the run index
support clinic lookup and latest-run retrieval. Sync-batch repeats map/current
row reads and crypto work, then latest-weight reads per affected patient.
No D1 query plans, row-read billing, retry behavior or A.2 performance were
measured. Target optimization decisions remain pending source recovery.

Old guardian phone matching and patient guardian/name matching use LIMIT 1
(efSyncUpsertGuardian / efSyncUpsertPatient), without ambiguity quarantine.
Do not deploy these functions as replacements for the stabilized mapping.
efSyncEnsureSchema uses CREATE TABLE/INDEX IF NOT EXISTS. No schema, data,
sourceRef, mapping criteria, crypto keys, or production secrets were changed.

## Verification performed and limits

- V8 compile-only syntax check passed for all 8 existing JS files, the Worker
  as an ES module, and 2 nonempty inline scripts in index.html (11 units).
  This catches invalid templates and lexical declaration syntax errors.
- `manifest.webmanifest` parses as JSON.
- Existing Worker/UI files remain unchanged from main, preserving Toss,
  SOLAPI OAuth, Kakao, Home, HQ, Patient CRM, subscriptions, billing,
  authentication, encryption, and embedded migration functions byte-for-byte
  in Git. No claim of target-source regression equivalence is made.
- Source-identity guard rejects the stale Worker and version-only substitution.
  Its 3 local tests pass. The current guard exits 1 with ok=false; this is
  expected and is a deployment blocker.
- Full undefined-variable, duplicate-function and unreachable-code linting is
  pending. Syntax compilation alone does not establish these properties.
- No production API, D1, deployment, Agent execution, or scheduled-task change
  was performed. No new migration or application feature was introduced.

## Completing this draft

1. Obtain the exact deployed A.2 Worker export or original A.2 release ZIP from
   its owner. Keep secrets outside Git. Verify the recorded hash; investigate
   a mismatch rather than changing constants or the expected hash to pass.
2. Restore only the verified Worker to this main-based branch. Do not merge
   staging artifacts or apply truncated diffs. Windows CRLF checkouts are
   accepted by the guard only when LF normalization matches the recorded hash.
3. Diff all functions/routes against main. Review Toss, SOLAPI, Kakao, Home,
   HQ, CRM, subscriptions/payments, authentication/encryption, and migrations.
   If safe integration changes are needed, document the new source identity
   and review the differences explicitly; do not label a modified source exact.
4. Verify ledger idempotency, ambiguous matching quarantine, at most three
   retries before dead letter, checkpoint/resume, eligible-count reconcile,
   missing/extras semantics, every query's clinic scope, and additive schema.
5. Add local mocked behavior tests, syntax/lint and route checks for that source.
   Record results, then request review. Do not close Issue #3 prematurely.

## Deployment and post-deploy smoke test

**Manual production deployment required.** This repository has no automatic
Worker deploy pipeline. The local guard is an explicit manual preflight, not
an enforced Cloudflare or branch-protection policy. No production action is
authorized by a passing local check alone.

After source validation, review and approved merge, a human deploys the
reviewed Worker with existing D1 bindings and secrets unchanged. Keep a copy
of the actual pre-deploy A.2 source/configuration as recovery material; do not
use the old main Worker or historical README rollback packages.

After that deployment:

1. Read `/efriends/v1/health` using the existing secure authentication method;
   expect ok=true, version=10.7-A.2, db=true.
2. Read `/efriends/v1/status` and confirm expected clinic and latest run.
3. Inspect the existing reconcile result: status=ok, differences=0, missing=0;
   historical extras above remain informational. Do not automatically POST a
   reconcile request or run FullReconcile to clear extras.
4. Verify the installed Windows Agent remains A.4 and the existing scheduled
   task is unchanged. Inspect the next normal scheduled run: completed,
   retry=0, deadLetter=0; inspect quarantine/checkpoint status.
5. Verify Clinic Sync Center, normal patient workspace, timeline/weight display,
   vaccination/heartworm due dates and eFriends status. Complete the reviewed
   non-destructive regression smoke plan for payments, OAuth, Home and HQ.
