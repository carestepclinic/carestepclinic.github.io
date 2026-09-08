# Production source audit — 2026-09-08

## Status: exact v10.7-A.2 Worker restored on Draft branch

This branch is based on `origin/main` at
`26395b304c94ea40a016c44b2e815da828e91c75` and exists only to synchronize the
repository Worker source with the already-running Production Worker. No
Cloudflare deployment, D1 migration, FullReconcile, production data write,
Windows Agent change, or main merge was performed by this work.

Issue #3 remains the tracking issue until the repository change is reviewed and
an explicitly approved production deployment is completed later.

## Production baseline

| Component | Version |
| --- | --- |
| Clinic UI | v10.7-A |
| Cloudflare Worker | v10.7-A.2 |
| Windows eFriends Agent | v10.7-A.4 |

The hospital Agent remains installed at
`C:\CARESTEP_eFriends_Sync\CARESTEP_eFriends_Sync_Agent_v10_7_A.ps1`, scheduled
under SYSTEM every 15 minutes. The repository cleanup does not alter it.

Reported final reconcile remains `status=ok`, `differences=0`, `missing=0`.
Historical patient and visit extras are informational, not missing data.
Vaccination eligibility remains based on unique sourceRef values.

## Exact Worker provenance

Verified audit source:

- Branch: `fix/v10.7-worker-source-of-truth`
- Audit path: `incoming/worker-v10.7-A.2.txt`
- Original provenance commit: `a56ea76a8036e01deb2f3527e64bd3c7821b5503`
- Git blob: `4f6006108b35552a7d63d6370a29f482aa1161a2`
- SHA-256: `9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7`
- `CARESTEP_VERSION='10.7-A.2'`
- `CARESTEP_BUILD='10.7-A.2'`
- `EFSYNC_VERSION='10.7-A.2'`

GitHub Actions downloaded the file directly from `raw.githubusercontent.com`
using the branch commit SHA and calculated the SHA-256 above. The downloaded raw
file was also byte-compared with the checked-out audit file.

The `incoming/` file is retained for provenance/audit only. **It is not a
production deployment path.** After review and merge, the canonical deployment
source is repository root `worker.txt`.

## Exact main-to-A.2 diff summary

Compared with `origin/main:worker.txt`:

| Measure | main Worker | A.2 Worker |
| --- | ---: | ---: |
| Bytes | 756,410 | 933,790 |
| Lines | 4,720 | 5,305 |

Git diff: **719 insertions / 134 deletions** across the Worker source.

Version alignment changes include:

- `CARESTEP_VERSION`: `10.5-A` → `10.7-A.2`
- adds `CARESTEP_BUILD='10.7-A.2'`
- `EFSYNC_VERSION`: `10.5-A` → `10.7-A.2`

The change is not a version-label-only patch. It contains the deployed
stabilization and operational code.

## Regression inventory

Static comparison found:

- main named functions: 505
- A.2 named functions: 610
- existing named functions removed: **0**
- existing CREATE TABLE identifiers removed: **0**

A.2 adds operational functions for recovery, notification policy, follow-up
cases, HQ sessions, partner clinical audit, patient quality controls and the
new eFriends stabilization layer.

New additive schema identifiers include:

- `efriends_sync_ledger`
- `efriends_sync_failures`
- `efriends_sync_quarantine`
- `efriends_sync_checkpoints`
- `efriends_sync_reconcile`
- `efriends_sync_heartbeat`
- `efriends_patient_search_index`
- `hq_sessions`
- `partner_api_data_audit`
- follow-up, notification, release-state and data-quality tables

No existing CREATE TABLE identifier was removed by the A.2 source.

## Existing product-area regression review

The recovered A.2 source retains static implementation markers for all required
areas:

- Toss Payments / billing
- SOLAPI OAuth and messaging
- Kakao channel/template configuration
- Carestep Home
- HQ administration
- subscriptions and billing
- authentication/password/session handling
- AES-GCM encryption and encrypted Patient CRM storage
- guardian/patient/timeline Patient CRM tables and logic
- partner APIs and clinic-scoped operations

The exact source also preserves all 505 named functions present in main, which
is stronger than keyword-only presence checking. This is a static regression
gate; it does not replace production smoke tests with live providers.

## eFriends v10.7-A.2 stabilization review

The Worker sets `EFSYNC_RETRY_LIMIT=3` and retains bounded batches of 100
guardians, 100 patients and 1,200 events.

Required endpoints are present:

- `GET /efriends/v1/health`
- `GET /efriends/v1/status`
- `POST /efriends/v1/runs`
- `POST /efriends/v1/runs/{id}/finish`
- `POST /efriends/v1/sync-batch`
- `POST /efriends/v1/reconcile`
- `GET/POST /efriends/v1/checkpoint`
- `POST /efriends/v1/retry-due`
- `POST /efriends/v1/heartbeat`
- `POST /efriends/v1/search-index`

Safety behavior reviewed in source:

- Sync Ledger records per-record state and last success/error.
- Retry failures are encrypted and queued; attempts reaching the limit become
  `dead_letter`.
- Ambiguous patient identity conflicts are put in quarantine instead of being
  auto-merged.
- Checkpoints are keyed by clinic, agent, snapshot and kind and update cursor
  monotonically.
- Reconcile has dedicated storage and reports missing/extras separately.
- Eligible source counts are used for event reconciliation, including
  vaccination and heartworm eligible counts supplied by the Agent.
- Patient/event/map/status/retry/checkpoint/reconcile queries reviewed in the
  A.2 block bind the configured clinic id.
- Run completion UPDATE binds both run id and clinic id.
- The schema additions are `CREATE TABLE/INDEX IF NOT EXISTS` plus the additive
  `care_patients.active` column/index check; no DROP is present in this cleanup.

The current A.4 Windows Agent remains responsible for unique vaccination
sourceRef eligibility. No FullReconcile is required for the historical extras.

## Automated verification

Branch CI performs the following before review:

1. download the audit Worker from GitHub raw using the exact commit SHA;
2. calculate and compare SHA-256 against the pinned A.2 hash;
3. byte-compare raw and checked-out audit files;
4. verify CARESTEP_VERSION and CARESTEP_BUILD;
5. compare exact diff statistics against `origin/main:worker.txt`;
6. ensure no existing named function or CREATE TABLE identifier disappears;
7. verify required Toss/SOLAPI/Kakao/Home/HQ/Billing/Subscription/Auth/
   Encryption/Patient CRM/eFriends markers;
8. syntax-check the Worker with Node.js;
9. run `tools/verify-worker-source.test.mjs`;
10. after root synchronization, run `tools/verify-worker-source.mjs` against the
    canonical root Worker and byte-compare it with the audit copy.

A passing check proves source identity and static preservation. It does not
exercise live Toss, SOLAPI, Kakao, D1 billing metrics, Cloudflare bindings or
hospital production data.

## Deployment gate

This Draft PR must remain Draft. Do not merge or deploy as part of this audit.

After a later explicit merge/deployment approval, a human should:

1. confirm the merged root `worker.txt` still has SHA-256
   `9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7`;
2. preserve existing Cloudflare secrets and D1 bindings;
3. deploy only the root `worker.txt`, not the `incoming/` audit copy;
4. verify `/efriends/v1/health` returns `ok=true`, `version=10.7-A.2`, `db=true`;
5. verify `/efriends/v1/status` for the expected clinic/latest run;
6. inspect the existing reconcile result without running FullReconcile;
7. confirm the Windows Agent remains v10.7-A.4 and its scheduled task unchanged;
8. inspect the next normal sync for retry/dead-letter/quarantine/checkpoint state;
9. smoke-test patient workspace/timeline/weight/vaccination/heartworm status;
10. perform non-destructive live smoke checks for Toss, SOLAPI/Kakao, Home, HQ,
    subscriptions, auth and Patient CRM before considering Issue #3 complete.
