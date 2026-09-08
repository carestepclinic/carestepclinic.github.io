# A.2.2 followup assignment schema contract

Production migration/deployment remains BLOCKED. This change and its tests did not access Production.
Branch: fix/v10.7-a2-regression-p1. PR #5 stays Draft, base fix/v10.7-worker-source-of-truth.
PR #4 head 94cbdff853c0421719b6f808782a29ca8eaf3c42 remains unchanged and Draft/BLOCKED.

## Defect and contract

A.2/A.2.1 reads assignee_user_id and vet_user_id in patientWorkspace/followupSafetyState
and writes both in putFollowupAssignment. Its 24-column care_followup_cases bootstrap
and legacy initialization never guaranteed them. A fresh DB can initialize successfully
yet fail assignment UPDATE with a missing-column error. Legacy databases can have the same gap.
The previous 36 checks did not exercise this schema contract.

Source inventory in the current Worker: bootstrap at line 289; the new helper
at line 1379 and its ensureSaasDb call at line 1401; patientWorkspace reads at
line 4012; followupSafetyState at line 4175; the sole assignment UPDATE in
putFollowupAssignment at line 4176. The existing INSERT statements name their
columns explicitly (lines 3366, 4026 and 4166) and omit both assignment columns.
User and clinic membership conventions are at lines 218-219. SELECTs feeding the two
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
a reviewed/preflighted candidate. Therefore this new candidate is 10.7-A.2.2 in
CARESTEP_VERSION, CARESTEP_BUILD and EFSYNC_VERSION. UI and Windows Agent remain unchanged.

- Superseded A.2.1 candidate: 66403079610f63123e5c7c653f32e8b468011a3a00fda4beab670ed25fbb4624.
- New A.2.2 candidate: 677e602440017e1ff781524e8da04b00044939ade6d66a4065cdfa0dbbdcc3c9.
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
returned 26,1,1,1,1. This documentation check is not added to the 50-test total.

Existing regression 19 + local D1 13 + verifier 4 remain passing: 36 preserved.
Combined: 50 PASS / 0 FAIL. Hash/syntax/inventory/diff checks are separate gates.
All 610 original A.2 functions and existing tables remain; one helper is added.
Four existing A.2 bodies differ: the three prior ledger functions and ensureSaasDb.
Toss, SOLAPI, Kakao, Home/HQ/Auth/Encryption/CRM business functions retain the prior behavior.
CI runs both isolated D1 suites and the existing checks for the final pushed commit.
A deliberate egress probe in the old suite is denied locally; no external request is sent.

## Minimal Production proposal — NOT executed or approved

The actual extra Production columns are still unconfirmed; source-derived candidates are
not a substitute for a scoped metadata check. Proposed query below returns only numbers.
Expected result for precisely this 26-column contract: 26,1,1,1,1.
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
The proposal is not part of any existing approved allowlist. A new pinned tool/allowlist
and offline fixtures must be reviewed and separately authorized before Production execution.

## Where preflight resumes

Do not automatically resume SQL 07–32 or rerun prior tools.
After reviewing this commit and green CI, separately approve a numeric contract query.
If the two Production columns match, update the future preflight fixture to the full 26-column
contract with position-independent comparison. If they differ, retain BLOCK and review the
existing definition; do not remove/replace columns to satisfy the validator.

Next remaining gates include consult defaults, SQL 07 index/trigger definitions, consult index
details and page/space estimates, ledger preservation and aggregate checks as explicitly approved.
Backups/recovery, writer control and rollout authorization remain separate. No migration,
deploy, FullReconcile, Agent change, main push/merge or PR Ready transition is authorized here.
A.2 code rollback still reintroduces cross-clinic ledger collisions and is not a safe rollback.
