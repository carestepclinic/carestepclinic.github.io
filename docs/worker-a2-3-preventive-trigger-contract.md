# A.2.3 preventive delivery cleanup trigger contract

Local corrective work is complete; Production migration and deployment remain
BLOCKED pending the remaining preflight and separate approvals. This code task
made **zero Production requests and zero Production writes**. PR #5 stays Draft,
base `fix/v10.7-worker-source-of-truth`; PR #4 stays Draft/BLOCKED and unchanged.

## Defect, evidence and identity

The existing preventive push feature stores history in
`care_home_preventive_push_deliveries`. A.2.2's `SAAS_SCHEMA_STATEMENTS` creates
that table, but its bootstrap and upgrade never guarantee patient-delete cleanup.
Fresh/legacy instances can therefore retain delivery history after patient deletion.
The Production object was discovered during an earlier schema preflight; its
creation/change provenance was **not found in the local repository or Git history**.
Its name alone was not treated as evidence of safe behavior.

The operator confirmed the exact behavior below through a separately approved
read-only trigger-definition query: **one HTTP query, zero writes**. The original
definition SHA-256 is
`FFE55186333E559309E628A9BECB6038F7B0DD88CA68024B7425606814BDB75D`.
This document records the confirmed contract and hash, not a recovered log or
copy of the raw Production definition. The formatted SQL below is the source
contract; its bytes need not equal the raw Production definition hash.

| Candidate | Identity |
| --- | --- |
| Preserved, undeployed A.2.2 | commit `c3ca52b186e5075fd712b233cf935b064a46e75c`, SHA-256 `677e602440017e1ff781524e8da04b00044939ade6d66a4065cdfa0dbbdcc3c9` |
| Current A.2.3 | `CARESTEP_VERSION`, `CARESTEP_BUILD`, `EFSYNC_VERSION` all `10.7-A.2.3` |
| Current root Worker SHA-256 | `57c1076d2026e2d5d3a2632690d873041533d229847c3d3afc26bf850ca3076a` |
| Immutable deployed A.2 audit | `incoming/worker-v10.7-A.2.txt`, SHA-256 `9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7` |

A.2.2 was not deployed, but already had a reviewed/preflighted identity. A.2.3
therefore identifies this additional P1 fix, following the prior corrective
versioning decision. A.2.2 remains reproducible from its pinned Git object; it
has not been relabeled or overwritten as audit evidence. No UI/Agent version changes.

## Contract and creation order

```sql
CREATE TRIGGER IF NOT EXISTS trg_care_home_preventive_push_patient_delete
AFTER DELETE ON care_patients
BEGIN
  DELETE FROM care_home_preventive_push_deliveries
  WHERE patient_id = OLD.id;
END;
```

This is a source specification, not a Production execution instruction.
`PREVENTIVE_PUSH_DELETE_TRIGGER_SQL` and the two helpers in `worker.txt` implement it:

1. On a cold `ensureSaasDb`, `ensurePreventivePushDeleteTriggerSchema(env,true)`
   checks any existing same-name object and already-present dependencies before
   the bootstrap batch. Wrong definition/object/dependency returns 503 with only
   `PREVENTIVE_PUSH_DELETE_TRIGGER_CONTRACT_MISMATCH` as error message/code.
2. The existing `SAAS_SCHEMA_STATEMENTS` batch creates tables, including both
   `care_patients` and `care_home_preventive_push_deliveries`.
3. `ensurePreventivePushDeleteTriggerSchema(env)` requires both objects to be
   tables, `care_patients.id` to be TEXT and the sole primary-key column, and
   delivery `patient_id` to be TEXT. Missing/invalid dependencies block creation.
   Fresh tables missing during step 1 are permitted only until this post-table check.
4. If the trigger is missing, create it with IF NOT EXISTS. If present and
   compatible, issue **no trigger DDL**. Read the resulting definition again and
   verify the entire contract. No DROP, replacement, row copy or cleanup sweep occurs.
5. Existing assignment, consult and other upgrade checks continue unchanged.

The previously confirmed Production trigger is a **no-op** under A.2.3 if its
definition and dependencies have not changed. Missing triggers in other clinics
or fresh DBs are created. Drift is never repaired by silently replacing an object.
The helper also converts D1 errors into the fixed contract error without SQL or
row payload in that error; it does not treat query failure as permission to create.

## Comparison boundaries

`preventivePushDeleteTriggerMatches` tokenizes the complete input with a sticky
lexer and consumes the entire restricted CREATE TRIGGER grammar. It does not
prove safety through substring presence or a raw-definition hash comparison.

Accepted: ASCII whitespace and keyword/identifier case differences; double-quoted,
backtick or bracket identifiers; optional IF NOT EXISTS; optional FOR EACH ROW;
outer predicate/operand parentheses; `=` or SQLite's equivalent `==`; reversed
equality operands; qualification of delivery `patient_id`; optional final semicolon.

Required: the fixed trigger name, AFTER DELETE event on care_patients, one body
statement deleting only from care_home_preventive_push_deliveries, and equality
between that table's patient_id and OLD.id. Identifier tokens are distinguished
from keywords and punctuation. There is no OR, additional condition, WHEN, extra
body statement, trailing statement, string literal or comment in the accepted grammar.
An otherwise harmless unsupported spelling blocks for review; it is not rewritten.

Before/UPDATE events, other target/action tables, wrong OLD column, unbounded
DELETE, OR-broadened scope, extra DELETE/UPDATE/INSERT/SELECT and trailing SQL all
fail. The checker does not run the returned schema definition as a query.

## Patient, merge and clinic behavior

`care_patients.id` is a global TEXT primary key; the delivery table has patient_id
but no clinic_id. Current patient deletion uses `id AND clinic_id`, and merge
validates clinic ownership before moving history. The trigger consequently uses
the exact confirmed `patient_id = OLD.id` condition without inventing a child
clinic column or broadening it with an OR. A composite patient PK fails the
dependency check because it would invalidate this patient-only cleanup premise.

`patientMergePatient` moves preventive delivery patient_id to the retained patient
before deleting the source patient. The trigger sees the old source ID and leaves
those moved deliveries intact. The tests extract the existing Worker merge UPDATE
and patient DELETE statements; no business function is modified by this fix.
Other patients, other clinics and pre-existing orphan evidence remain unchanged
during upgrade. Actual later patient deletion removes only that patient's history.

This does not retrospectively repair malformed patient references, audit historical
cross-clinic data or resolve a push already selected in memory before deletion.
Full initialization still contains pre-existing policy DML. It is neither a
read-only endpoint nor a standalone DDL-only Production migration. The whole
initializer is not one transaction. IF NOT EXISTS plus post-check handles a
compatible concurrent create, but operational control of other DDL writers is
still required. Warm `saasDbReady` instances do not continuously recheck drift.

## Independent local D1 evidence

`tools/d1-readiness/preventive-trigger-contract.mjs` uses one nonpersistent
Miniflare/workerd D1 instance per scenario, loopback binding, `cf:false`, synthetic
data and an outbound deny handler. No Wrangler config, remote binding, credential,
Production log or existing user DB is read. Separate current/cold/A.2.2 modules
exercise full upgrade without allowing the readiness flag to hide rerun failures.

**40 PASS / 0 FAIL**, including:

- Pinned A.2.2 identity, version/function/table inventory and fresh table-before-trigger order.
- Actual full A.2.2 upgrade, minimal legacy creation, existing canonical no-op.
- Twelve semantically equivalent stored definitions, all preserved byte-for-byte.
- Twelve stored mismatches, all blocked before any initializer schema/data writes;
  existing objects, rows and PK metadata remain identical.
- Trailing SQL/literal/comment rejection; missing tables/column, non-global PK,
  non-TEXT patient_id and view dependency rejection.
- Patient delete, foreign-clinic no-op, merge preserving moved deliveries,
  cold full initialization and direct contract rerun idempotency.

The existing **50** checks are maintained: regression 19, local D1 readiness 13,
assignment 14 and verifier 4. Combined **90 PASS / 0 FAIL**, with zero outbound
attempts in this trigger suite. The older readiness suite's deliberate egress
probe is denied locally; no external request is sent. Worker syntax/hash and
Git diff checks are additional gates, not counted as tests. CI runs all suites.

```sh
pnpm --dir tools/d1-readiness install --frozen-lockfile --ignore-scripts
node tools/d1-readiness/preventive-trigger-contract.mjs
```

All 610 original A.2 named functions and existing table declarations remain.
Four existing function bodies differ from A.2 across the stacked correction.
Against A.2.2, only ensureSaasDb's existing body changes and two helpers are added.
All pre-existing trigger definitions remain; the new object is additive.

## Preflight resumption and manual gates

Existing tools and restricted logs outside Git remain unchanged. This task creates
no replacement preflight tool and executes no Production SQL.

Next, prepare and offline-review a **new A.2.3 Phase 1C** tool pinned to the new
commit/Worker hash. Its scoped inventory becomes **16 indexes and 8 triggers**
(the previous 7 plus this cleanup trigger). Validate the new trigger's exact
semantics and include its already-created delivery-table dependency in the review.
Do not simply make every previously unexpected object acceptable.

After separate tool/hash/SQL approval, the intended resume point is schema SQL 07,
conditional consult index detail 11, numeric consult-default C1 (expected 2,1,1),
and page getters 12–14. These are plans, not current execution approval. The v2
absence/no-schema-change premise must be reconfirmed; its two expected indexes
may be absent before upgrade. Unexpected objects or definition drift still BLOCK.
The prior SQL 07 failure did not certify the remaining index/trigger inventory.

Page_count × page_size estimates allocation; (page_count − freelist_count) ×
page_size estimates occupied pages, not exact live row bytes. Cloudflare quota,
actual migration headroom/latency and writer control remain unconfirmed. Keep
capacity WARN until measured and approved; insufficient or unresolvable headroom
blocks rollout. SQL 15–32/aggregate checks require their own later approval.

Production backup/recovery, exact additive migration artifact, rollout and smoke
each require separate human approval. A.2 rollback revives global-ledger collisions;
retaining additive schema does not make an old code revert a safe rollback.
No Production connection, migration, deploy, DROP/trigger change, FullReconcile,
Agent change, main merge/push, PR Ready or PR #4 change was performed here.
