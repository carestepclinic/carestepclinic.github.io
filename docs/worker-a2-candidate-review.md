# A.2 candidate review — 2026-09-08

> Historical A.2 / PR #4 evidence. On the corrective branch, see
> [A.2.1 corrective design and current test results](worker-a2-1-corrective.md).
> To reproduce the original A.2 review, use the tool from commit `94cbdff`;
> the current tool targets A.2.1. PR #4 itself remains unchanged.

## Decision

**Identity PASS; regression gate FAIL; replacement not approved by this review.**
The user required both checks to pass. This review initially left root Worker
unchanged. Concurrent remote commit `c44aeb95c1f31f3877fb1d03c6a422b6aa0fdc29`
already restored it and added static CI while these tests were running. That
remote work was preserved during branch integration, not reverted or force-pushed.
Root Worker therefore contains the exact A.2 source, but it has **not passed**
this regression gate. No main merge, Cloudflare deploy, production D1 migration,
FullReconcile, or Windows Agent change occurred.

Source: user-supplied `incoming/worker-v10.7-A.2.txt` (provenance committed separately in `a56ea76`).
Length: 933790 bytes. Raw SHA-256, without newline normalization:

`9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7`

Matches the requested hash and HOTFIX_A2.md exactly. CARESTEP_VERSION and
EFSYNC_VERSION both equal `10.7-A.2`.

Base: fetched main `26395b304c94ea40a016c44b2e815da828e91c75`.
Branch: `fix/v10.7-worker-source-of-truth`. Existing Draft PR:
<https://github.com/carestepclinic/carestepclinic.github.io/pull/4>.

## Exact diff and integration review

Git text diff: **719 additions / 134 deletions** (ignoring Git checkout CRLF
conversion). Named top-level function comparison: 505 before, 610 after;
**0 removed, 105 added, 54 changed, 451 unchanged**. Bodies were compared via
V8 function source with only CRLF-to-LF normalization. Existing literal route
paths were retained. These checks do not prove every changed code path safe.

| Area | Observed result |
| --- | --- |
| Toss / Billing | Existing billing-key crypto, Toss API, setup, charging, cancellation, retry and scheduled billing function bodies unchanged |
| SOLAPI / Kakao | OAuth scopes, token exchange/refresh, callbacks, sender lookup, channel/templates, legacy fallback and sending functions unchanged |
| Subscription | Charging and plan-change functions retained unchanged; Home entitlement flags added; HQ subscription DTO adds partner channel metadata |
| Auth / Encryption | Existing SaaS/Home passwords, sessions and crypto functions unchanged; HQ adds async session auth while retaining master-key auth; callers await it |
| Home | Entitlement gates, consultation response history, push grouping and follow-up state are additions/changes; not certified end-to-end; upgrade failure below affects initialization |
| HQ | Existing routes retained; session/create/delete, deployment and automation routes added; local missing-auth/master-key checks pass |
| Patient CRM | Existing named functions retained; active-patient scope, search/workspace, data-quality/explicit merge/delete safety and clinical protocol changes present; no CRM data was modified in this audit |
| eFriends | Ledger, quarantine, retry queue, checkpoint, heartbeat, eligible-count reconcile and search index present; ledger isolation FAIL below |

The supplied source includes more than an eFriends-only patch. Category
compatibility maps, Home feature flags, partner clinical APIs and follow-up
operations are part of that exact supplied artifact, not newly implemented
features in this branch.

## P1: ledger key does not isolate clinics

Candidate locations: schema line 4573; `efSyncRecordKey` line 4609;
`efSyncLedgerMark` line 4610.

`record_key` alone is the primary key. Its value is
`kind:externalId:sourceRef`, omitting clinic_id. The INSERT supplies clinic_id,
but `ON CONFLICT(record_key) DO UPDATE` does not constrain the existing clinic.

Reproduction executes the actual candidate schema and `efSyncLedgerMark` in
in-memory SQLite. Write the same external patient ID for clinic-A and clinic-B.
Expected: two rows. Actual: one row owned by clinic-A with clinic-B's
carestep_id and run_id. This can corrupt a clinic's sync ledger when multiple
clinics share a D1 database and external identifiers overlap. It is not proof
that the currently single configured hospital has experienced corruption.

This violates the requested clinic-isolation gate. An approved corrective
change would need a clinic-scoped key/conflict strategy and explicit treatment
of existing ledger rows. Do not rewrite live keys or run a migration here.

## P1: existing-schema upgrade fails before its additive column migration

Candidate locations: index declaration line 341; `ensureSaasDb` line 1380;
column ALTER checks around lines 1454-1456; later index creation line 1465.

`ensureSaasDb` first batches SAAS_SCHEMA_STATEMENTS. That array already tries
to create `idx_care_home_followups_consult_status` using consult_status and
consult_updated_at. On the main schema these columns do not exist; they are
added only later by ALTER TABLE logic, which is never reached.

Reproduction creates the pinned main schema in memory, then calls the actual
candidate `ensureSaasDb`. Result: **no such column: consult_status**.
This is an upgrade/restore-path failure, not evidence that the current
production database (which may already contain those columns) is down.
An approved corrective change would order dependent index creation after
the existing additive column migration, then retest old and fresh schemas.

## Additional behavior and D1 observations

- Status reads latest run/reconcile snapshots and grouped pending failure
  counts; it no longer counts all guardian/patient/event maps on every call.
- Reconcile still scans a clinic's matching eFriends event/index range for
  COUNT/GROUP BY, plus clinic map counts. No real D1 cost measurement was done.
- Eligible counts take precedence via nullish fallback, including zero.
  Positive diffs become missing; negative diffs remain extras. The Worker
  relies on Agent A.4 to supply unique vaccination sourceRef counts; it does
  not deduplicate raw source CSV rows itself.
- Checkpoints retain the larger cursor and isolate clinic/agent/snapshot/kind.
- Shared-phone candidates quarantine without creating a guardian map.
- EFSYNC_RETRY_LIMIT=3 counts **total recorded failures**: first and second
  failures enter retry, third enters dead_letter. This is two retries after
  an initial failure, not three retries. Preserve this observed behavior in
  the audit; do not silently alter the exact artifact to match different prose.
- Start-run cleanup deletes checkpoints and resolved failure rows older than
  90 days within the clinic. The source also includes explicit repair/merge/
  deletion routes and deletion triggers. These were not executed; "additive
  schema" must not be represented as "this Worker never deletes data."
- Health's db=true reports binding presence, not a database connectivity query.

## Reproduce locally

Requires Node.js 24 and Git. CARESTEP_GIT may point to a Git executable when
Git is absent from PATH. The base commit is pinned inside the tool for a
repeatable comparison. The script never copies/replaces the candidate.

```sh
node --experimental-vm-modules tools/review-worker-candidate.mjs incoming/worker-v10.7-A.2.txt
node --test tools/verify-worker-source.test.mjs
node tools/verify-worker-source.mjs
```

The review gate must exit nonzero until its isolation and upgrade tests pass.
Latest run: **10 PASS / 2 FAIL** (ledger isolation and upgrade ordering), with
exit code 1. Before branch integration, source-identity unit tests passed **3/3**; after
restoration they pass **2 with 1 expected skip**. Candidate
and baseline compile as ES modules; the candidate's raw hash still matches.
After integrating the concurrent restoration, the root source guard passes
identity verification. Its original unit tests remain intact (the stale-source
test now skips). This does not override the failing behavioral checks. Source syntax is compiled in
an isolated VM with no fetch or external imports; tests use in-memory SQLite
and synthetic values only. No production secrets or records are read.

Full undefined-variable/unreachable-code lint, external-provider integration
tests, complete changed-route behavior and production smoke tests are not
certified. Passing hash/function-presence checks does not override the two
reproduced failures.

## Human production gate

Keep PR #4 Draft; do not merge or deploy this candidate from the repository.
Review the reproduced defects and decide how to separate exact production
archival from an approved corrective release. Fixing the artifact changes its
hash, so a corrected source must not be described as the unchanged A.2 original.
No automatic data/key migration is proposed or performed.

After approved fixes and local regression validation, review the deployment
diff and schema plan before a separate manual deployment. Then verify health,
clinic status, reconcile ok/differences=0, historical extras, normal sync
retry/deadLetter counters and the unchanged A.4 Windows schedule, plus the
reviewed Home/HQ/CRM/payment smoke plan. No FullReconcile is required.
