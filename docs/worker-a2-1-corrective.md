# Worker v10.7-A.2.2 — P1 corrective delta

## Scope and identities

Corrective branch: `fix/v10.7-a2-regression-p1`, based on PR #4 head
`94cbdff853c0421719b6f808782a29ca8eaf3c42`. The new Draft PR targets
`fix/v10.7-worker-source-of-truth`, not main. PR #4 remains Draft/BLOCKED; its
branch, metadata and immutable A.2 source are not changed by this work.

| Artifact | Version | SHA-256 (Git/LF bytes) |
| --- | --- | --- |
| `incoming/worker-v10.7-A.2.txt` | Exact deployed A.2 audit | `9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7` |
| `worker.txt` on corrective branch | 10.7-A.2.2 | `677e602440017e1ff781524e8da04b00044939ade6d66a4065cdfa0dbbdcc3c9` |

CARESTEP_VERSION, CARESTEP_BUILD and EFSYNC_VERSION are 10.7-A.2.2.
Clinic UI remains 10.7-A, Windows Agent remains 10.7-A.4. A.2.2 is a
corrective candidate, **not the version currently deployed to production**.
No merge to main, deployment, production D1 migration, FullReconcile, Windows
change, or production data operation is performed here.

## P1-1: additive clinic-scoped ledger

Chosen design: a new `efriends_sync_ledger_v2` table with
`PRIMARY KEY(clinic_id,record_key)`. This avoids changing the legacy primary
key or rewriting existing keys in place. The record-key encoding and all
existing write fields/status semantics remain the same; the database conflict
target now includes clinic_id.

Two indexes support clinic/status/last-seen and clinic/last-seen lookup. New
schema creation uses CREATE TABLE/INDEX IF NOT EXISTS, so repeated cold-start
initializations are safe. There is no data-copy loop, bulk scan, DROP, DELETE,
or legacy ledger UPDATE in this corrective migration.

All runtime ledger access in this Worker is accounted for:

| Caller | A.2.2 behavior |
| --- | --- |
| efSyncEnsureSchema | Retains legacy DDL; adds v2 table and indexes |
| efSyncLedgerMark | Writes v2; ON CONFLICT(clinic_id,record_key) |
| efSyncProcessRow / efSyncRetryDue | Continue through efSyncLedgerMark |
| saasEmrSyncStatus | Reads latest v2 row with clinic_id filter |
| efSyncStatus | Unchanged; reads run/reconcile/failure counts, not ledger |

### Legacy retention and transition

The entire original `efriends_sync_ledger` remains intact as a legacy audit
table. **No automatic backfill is performed.** Old global-key collisions may
have left clinic_id from one clinic with carestep_id/run_id from another, so
blindly copying old rows into the authoritative v2 table would promote
unverified ownership. Retaining them without promotion is safer than copying
or attempting to infer missing history.

Subsequent normal sync/retry observations populate v2. Existing guardian and
patient maps, event state, checkpoints, failures, quarantine, runs, heartbeat
and reconcile snapshots are unchanged. They remain the sync/resume/deduplication
sources; introducing v2 does not trigger retransmission or FullReconcile.

Single-clinic processing retains the same API response shapes and row-write
semantics. `integrity.ledgerLastSeen` now means **last v2 observation** and can
initially be empty until the next processed row. Overall connection state uses
heartbeat/run timestamps and remains independent of this informational field.
There is deliberately no unverified legacy fallback in v2 status aggregation.

If historical ledger records must later be promoted, that requires a separate,
explicitly reviewed process validating clinic ownership against trustworthy
maps/runs and recording provenance. It must not overwrite newer v2 observations.
This PR supplies no such data-migration command, and cannot reconstruct rows
already lost to a historical collision.

### Rollback compatibility

A.2 does not reference v2, so retaining both tables avoids breaking old code's
schema expectations. An old Worker would resume legacy writes and reintroduce
the P1 risk; newer v2 observations would not appear in its ledger display.
Therefore rollback is a separately reviewed operational decision, not an
automatic response. Do not drop either table or reverse-migrate v2 rows.

## P1-2: initialize dependencies before indexes/triggers

Removed the premature consult-status index entry from SAAS_SCHEMA_STATEMENTS.
The existing CREATE INDEX IF NOT EXISTS after the consult_status and
consult_updated_at ALTER checks remains the sole creation site.

Fresh-empty initialization also exposed the existing follow-up patient-delete
trigger being declared before its target care_patients table. Its **unchanged
definition** is moved below care_patients creation. No deletion behavior is
added or changed. This ordering adjustment is necessary for the requested
fresh DB case, within the same initialization P1 scope.

Actual initializer tests cover a fresh empty database, pinned main-era schema,
the full main-era initializer followed by A.2.2, and repeated initialization
using a newly loaded Worker module to bypass the warm-instance readiness flag.
Already-present columns/indexes remain intact. No production schema is queried
or changed by these tests.

## P1-3: followup assignment schema contract

The A.2/A.2.1 Worker used `assignee_user_id` and `vet_user_id` without creating
them. A.2.2 guarantees both as `TEXT NOT NULL DEFAULT ''`, with no new FK/index.
Fresh bootstrap includes them. A post-table helper adds only missing columns,
rejects incompatible existing definitions without rewriting them, and checks
the final metadata. Existing rows and PKs are preserved; compatible columns
are a no-op. See [contract, source rationale and 14 local D1 cases](worker-a2-2-assignment-contract.md).

The superseded A.2.1 candidate hash was
`66403079610f63123e5c7c653f32e8b468011a3a00fda4beab670ed25fbb4624`.
It remains historical evidence; its prior approvals do not apply to A.2.2.

## Verification

```sh
node --experimental-vm-modules tools/review-worker-candidate.mjs worker.txt
node --test tools/verify-worker-source.test.mjs
node tools/verify-worker-source.mjs
# worker.txt contains an ES module; pass its text to node --check --input-type=module
```

The review script pins main-era commit
`26395b304c94ea40a016c44b2e815da828e91c75` and verifies the immutable A.2
artifact independently of the new corrective hash. Node.js 24 supplies
in-memory SQLite. No fetch or external imports are available to the Worker
test VM; synthetic data and an isolated SQLite adapter are used.

Latest local behavioral result: **19 PASS / 0 FAIL**, including:

- Same external ID/sourceRef across clinic-A and clinic-B: independent
  carestep_id/run_id/status, repeated writes without duplicates, and an update
  in A does not alter B; prior last_success_at semantics preserved.
- A.2 ledger rows unchanged after repeat initialization and v2 writes;
  no automatic backfill; repeat schema setup is idempotent.
- Sync Center ledger aggregation reads v2 only and filters clinic scope.
- Fresh, main-era and already-upgraded initialization succeeds.
- eFriends health/auth/status/runs/finish/empty sync-batch; reconcile
  eligible counts/missing/extras; checkpoint/resume; quarantine; retry/dead-letter.
- No existing named functions or schema table declarations removed.
- Only **4 of 610 A.2 named function bodies** differ: efSyncEnsureSchema,
  efSyncLedgerMark, saasEmrSyncStatus and ensureSaasDb. The other 606 are
  unchanged; ensureFollowupCaseAssignmentSchema is one new helper.
- Toss, Billing, Subscription, SOLAPI, Kakao, Home, HQ, Auth, Encryption,
  Patient CRM and remaining eFriends functions/routes are preserved.

Additional local checks: `node --check` passes for the Worker (temporary .mjs
copy) and all three verification modules; source-verifier unit tests pass
**4/4 with no skips**; root hash verification returns ok=true; git diff --check
passes. Local workerd/D1 readiness adds 13 checks and the new assignment suite
adds 14: **50 PASS / 0 FAIL** including regression 19 and verifier 4.

The A.2 retry policy is unchanged: third total failure enters dead_letter
(two retries after an initial failure). No Agent or vaccination eligibility
logic is changed. The existing A.2 regression report remains historical evidence;
it is not the result for A.2.2.

CI on this corrective branch verifies both distinct identities, syntax,
function/table preservation, markers, verifier unit tests and the behavioral
gate. PR #4's branch/CI file remain untouched until a separately approved merge.

## Before production

**Manual production deployment required, after separate approval.** These
local tests do not certify Cloudflare D1 runtime characteristics, actual
bindings, provider side effects, or live hospital state. Review the additional
v2 table/index storage and CREATE permissions, the no-backfill decision, the
initial empty ledgerLastSeen field and the rollback limitation.

The schema code would run lazily on a later approved deployment/request; adding
it to source does not execute a production migration now. Review legacy ledger
retention and backups before that deployment. Do not run FullReconcile to fill
v2. Let the unchanged A.4 scheduled Agent provide normal observations.

After approved deployment, check health version 10.7-A.2.2, expected clinic,
normal status/reconcile, the next scheduled sync, retry/deadLetter/quarantine,
and v2 ledger visibility. Keep Clinic UI/Windows Agent versions independent.
Complete the non-destructive Home/HQ/CRM/payment smoke plan and verify no
unexpected legacy-table writes by any other still-running A.2 Worker.

## Isolated local D1 readiness follow-up

The earlier A.2.1 candidate was exercised in local Miniflare/workerd D1,
including nonempty sync and real retry processing. See
[Production readiness evidence](worker-a2-1-production-readiness.md) for the
13 additional scenarios, isolation controls, rollback rehearsal and manual gates.
Those 13 cases were rerun on A.2.2 alongside the new 14 assignment cases.
This supplements the 19 SQLite regressions; it does not authorize deployment.
