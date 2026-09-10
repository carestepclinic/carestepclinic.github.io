# Followup assignment contract — introduced A.2.2, current A.2.3

Production migration/deployment remains BLOCKED. This change and its tests did not access Production.
Branch: fix/v10.7-a2-regression-p1. PR #5 stays Draft, base fix/v10.7-worker-source-of-truth.
PR #4 head 94cbdff853c0421719b6f808782a29ca8eaf3c42 remains unchanged and Draft/BLOCKED.

## Defect and contract

A.2/A.2.1 reads assignee_user_id and vet_user_id in patientWorkspace/followupSafetyState
and writes both in putFollowupAssignment. Its 24-column care_followup_cases bootstrap
and legacy initialization never guaranteed them. A fresh DB can initialize successfully
yet fail assignment UPDATE with a missing-column error. Legacy databases can have the same gap.
The previous 36 checks did not exercise this schema contract.

Source inventory in the current Worker: care_followup_cases bootstrap in
SAAS_SCHEMA_STATEMENTS; ensureFollowupCaseAssignmentSchema called by ensureSaasDb;
patientWorkspace and followupSafetyState read assignments; putFollowupAssignment
contains the sole assignment UPDATE. Existing case INSERT statements name their
columns explicitly and omit both assignment columns. The users and clinic_members
declarations establish the user/membership conventions. SELECTs feeding the two
read paths retrieve full case rows, then expose assignments with empty fallbacks.

Both columns now have TEXT NOT NULL DEFAULT '', pk=0. Empty string is unassigned.
This follows putFollowupAssignment's clean(id,160), empty-string return, and ||'' read
fallbacks, plus the application's existing TEXT user IDs and empty-string optional references.
clinic_members contains UNIQUE(clinic_id,user_id); writes validate active membership in
the current clinic. Existing authorization, revision checking and assignment SQL are unchanged.

No foreign key is introduced: empty string is an allowed unassigned sentinel, not a users row.
No new index is needed: assignment reads/updates locate the case by its existing clinic/case
or id key and do not filter/order by either assignment column. No cascade or user deletion
semantics are introduced. The new checker validates the two column contracts, not every
possible table CHECK/FK/UNIQUE constraint; those remain part of separately approved drift review.

## Additive implementation

Fresh CREATE places both columns after guardian_id, near the case's human assignments.
ensureSaasDb calls ensureFollowupCaseAssignmentSchema after the table bootstrap batch.
The helper inspects both existing columns before changing either. Incompatible existing
metadata throws only FOLLOWUP_ASSIGNMENT_SCHEMA_CONTRACT_MISMATCH (503); no values/schema
definitions are included in the message. Type case/whitespace and outer parentheses around
an empty-string default are accepted; nullable, PK, other types/defaults are not rewritten.

Only missing columns get ADD COLUMN. The full contract is checked again afterwards.
Compatible existing columns are a no-op. Partial legacy tables get only the missing column.
No DROP, table rebuild, data copy, UPDATE/DELETE of existing rows or foreign-key/index change
is performed by this helper. SQLite exposes the empty default for newly added fields;
all pre-existing fields and the original PK are preserved.

The full initializer already has other policy DML and must never be invoked as a Production
read-only preflight or assumed to be a DDL-only migration. It is not a transaction covering
the entire schema. Concurrent cold initializers/DDL writers still need operational control.
Existing incompatible definitions require a separately reviewed plan; do not repeatedly
retry startup or silently relax the contract.

## Version and identities

No separate formal release-version policy exists in the repository. The source-of-truth
policy requires distinct reviewed identity, and the Production Runbook requires a separate
version/hash for forward fixes. Although A.2.1 was never deployed, its hash already identifies
a reviewed/preflighted candidate. The assignment fix was therefore introduced as
10.7-A.2.2. The subsequent preventive cleanup contract uses the same reasoning for
10.7-A.2.3 in all three constants. UI and Windows Agent remain unchanged.

- Superseded A.2.1 candidate: 66403079610f63123e5c7c653f32e8b468011a3a00fda4beab670ed25fbb4624.
- Preserved undeployed A.2.2 candidate: 677e602440017e1ff781524e8da04b00044939ade6d66a4065cdfa0dbbdcc3c9,
  commit c3ca52b186e5075fd712b233cf935b064a46e75c.
- Current A.2.3 candidate: 57c1076d2026e2d5d3a2632690d873041533d229847c3d3afc26bf850ca3076a.
- Immutable incoming A.2: 9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7.

Old Worker approvals/hashes are not approval for this candidate. Existing external Phase 1
tools/allowlists/logs remain unchanged and are not committed or attached to the PR.

## Local validation

All tests use synthetic records and independent, nonpersistent Miniflare/workerd D1, with
loopback binding, cf metadata disabled and an outbound deny handler. No Wrangler config,
remote D1 binding, Production account/database ID, token, .env or user database is opened.
The new suite uses one isolated DB per scenario, disposed at the end.

tools/d1-readiness/assignment-contract.mjs: 14 PASS / 0 FAIL:
fresh contract; unchanged actual Worker INSERT omitting both columns; actual assignment UPDATE
with foreign-clinic preservation; legacy 24-column upgrade with rows/PK preserved; each partial
case; already-compatible no-op; cold repeat; four incompatible type/nullable/default/PK cases;
incompatible partial blocks before any ALTER; equivalent parenthesized defaults accepted.
The INSERT/UPDATE SQL is extracted from the Worker and executed against local D1.
This verifies persistence, not a live authenticated assignment endpoint or provider integration.

The proposed numeric query below was also checked separately in an in-memory
SQLite database with query_only enabled after synthetic schema creation. It
returned 26,1,1,1,1. This historical documentation check is not added to the test total.

Existing regression 19 + local D1 13 + verifier 4 remain passing: 36 preserved.
The original combined result was 50 PASS / 0 FAIL. A.2.3 reruns all 50 and adds
40 preventive trigger cases: **90 PASS / 0 FAIL**. Hash/syntax/inventory/diff checks
are separate gates. All 610 original A.2 functions and existing tables remain;
there are now three added helpers across the stacked corrective delta.
Four existing A.2 bodies differ: the three prior ledger functions and ensureSaasDb.
Toss, SOLAPI, Kakao, Home/HQ/Auth/Encryption/CRM business functions retain the prior behavior.
CI runs all three isolated D1 suites and the existing checks for the final pushed commit.
A deliberate egress probe in the old suite is denied locally; no external request is sent.

## Numeric contract query — historical proposal, subsequently confirmed

The operator subsequently confirmed the Production result **26,1,1,1,1** through
the separately approved A.2.2 assignment tool. Thus both extra columns and their
contracts are confirmed; the A.2.3 code task does not requery Production. The SQL
below is retained as the original design evidence, not new execution approval.
A zero match can also mean unrecognized but equivalent default spelling: BLOCK for review,
not permission to rewrite an existing column. Extra constraints/indexes require separate review.

```sql
WITH columns AS (
  SELECT name, type, "notnull", pk, dflt_value
  FROM pragma_table_info('care_followup_cases')
), checked AS (
  SELECT name,
    CASE WHEN upper(trim(type)) = 'TEXT'
      AND "notnull" = 1 AND pk = 0
      AND trim(dflt_value) IN (
        char(39) || char(39),
        '(' || char(39) || char(39) || ')',
        '((' || char(39) || char(39) || '))'
      ) THEN 1 ELSE 0 END AS contract_match
  FROM columns
)
SELECT
  COUNT(*) AS total_columns,
  COUNT(CASE WHEN name = 'assignee_user_id' THEN 1 END) AS assignee_present,
  COUNT(CASE WHEN name = 'vet_user_id' THEN 1 END) AS vet_present,
  COUNT(CASE WHEN name = 'assignee_user_id' AND contract_match = 1 THEN 1 END)
    AS assignee_contract_match,
  COUNT(CASE WHEN name = 'vet_user_id' AND contract_match = 1 THEN 1 END)
    AS vet_contract_match
FROM checked;
```

No name, default value, schema SQL or actual row data is returned. Only metadata is read.
The separately reviewed external assignment tool/allowlist and its logs remain
unchanged. Its previous execution approval does not authorize reruns or A.2.3 rollout.

## Where preflight resumes

Do not automatically resume SQL 07–32 or rerun prior tools.
The assignment numeric check is already complete. Future metadata fixtures must
retain all 26 columns and compare by name. Newly discovered drift still blocks;
do not remove/replace columns to satisfy a validator.

The operator also confirmed the preventive cleanup trigger with one separately
approved read-only definition query and zero writes. Its creation provenance in
Git remains unknown. A.2.3 preserves compatible instances as no-op, creates missing
instances and blocks mismatches without replacement; see the
[new trigger contract](worker-a2-3-preventive-trigger-contract.md).
Next prepare a new A.2.3 Phase 1C tool with 16 indexes and 8 triggers, offline-review
its new hashes and allowlist, then obtain separate execution approval. This task
does not create that tool or change any existing tool/log.

Next remaining gates include consult defaults, SQL 07 index/trigger definitions, consult index
details and page/space estimates, ledger preservation and aggregate checks as explicitly approved.
Backups/recovery, writer control and rollout authorization remain separate. No migration,
deploy, FullReconcile, Agent change, main push/merge or PR Ready transition is authorized here.
A.2 code rollback still reintroduces cross-clinic ledger collisions and is not a safe rollback.
