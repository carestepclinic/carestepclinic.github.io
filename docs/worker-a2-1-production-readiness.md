# Isolated D1 readiness: current A.2.2 and historical A.2.1

The current candidate is **10.7-A.2.2**, SHA-256
`677e602440017e1ff781524e8da04b00044939ade6d66a4065cdfa0dbbdcc3c9`.
Its [assignment contract validation](worker-a2-2-assignment-contract.md) adds
14 independent local D1 scenarios. The existing 36 checks were rerun and pass:
**50 PASS / 0 FAIL** combined. Production migration/deploy remains BLOCKED;
old A.2.1 approvals do not authorize this new candidate.

The sections below retain the original **A.2.1 historical evidence**. Their
36 checks did not cover the newly identified assignment-column contract.
Statements about unchanged Worker bytes describe that earlier follow-up only.

## Decision

2026-09-08: **isolated validation passed; Production rollout remains subject to manual approval.**
No new Worker defect was found in these scenarios. This is evidence for review,
not authorization to deploy or merge. PR #5 remains Draft, stacked on
`fix/v10.7-worker-source-of-truth`; PR #4 remains Draft/BLOCKED.

Starting branch: `fix/v10.7-a2-regression-p1`.
Starting HEAD: `cbcc6e1c087542d87dd568c7d0e094655276c94f`.
Starting working tree was clean, with no untracked files. Only tests, test
dependencies, CI and documentation change in this follow-up; Worker bytes do not.

| Artifact | SHA-256 |
| --- | --- |
| Unchanged A.2.1 Worker | `66403079610f63123e5c7c653f32e8b468011a3a00fda4beab670ed25fbb4624` |
| Immutable A.2 incoming artifact | `9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7` |

Both raw file hashes matched at start. Verification tools also accept CRLF-only
checkout normalization; their canonical comparison uses Git/LF bytes.

## Isolation and reproducibility

The additional suite is `tools/d1-readiness/readiness.mjs`. It uses pinned
Miniflare **4.20260730.0**, its lockfile-pinned workerd dependency, Node 24 and
pnpm 11.19.0. Miniflare exposes a **local simulated D1 binding**, not a remote
Cloudflare D1 database. The Worker functions run inside workerd, unlike the
older Node VM/SQLite-adapter suite. See Cloudflare's
[Miniflare D1 documentation](https://developers.cloudflare.com/workers/testing/miniflare/storage/d1/).

Isolation controls are explicit in source:

- Two separate Miniflare instances: `synthetic-fresh` and `synthetic-legacy`;
  `d1Persist: false`, loopback host `127.0.0.1`, dynamically assigned ports.
  Both instances are disposed in `finally`. No existing DB file is opened.
- Inline module definitions and locally declared D1 bindings only. No Wrangler
  config, account ID, remote database ID, remote proxy, `.env`, credential store
  or Production secret is loaded. Worker env is constructed from this local DB
  and literal synthetic authentication/encryption fixture values.
- `outboundService` returns HTTP 403 for every Worker outbound request.
  `cf: false` also disables Miniflare's public request.cf metadata download.
  Business scenarios produced **zero outbound attempts**. A final deliberate
  `offline.invalid` probe hit the deny handler once and received 403; it was
  not sent to that hostname. No provider endpoint was called.
- Candidate, repeat-candidate, pinned main and immutable A.2 code are loaded
  as separate modules. Test-only named exports are appended in memory; no
  Worker file or function body is rewritten. Fresh module state ensures the
  second bootstrap cannot pass merely because of a warm readiness flag.
- SQL observation wraps `prepare` but forwards **native D1 batch operations
  intact**. Queries are recorded in submission order; resulting schema and
  data are checked with the actual local D1 binding.
- All patients, guardians, clinic IDs, phone numbers and run IDs are synthetic.
  Dependencies came from the package registry; GitHub access is for source,
  commits, the Draft PR and CI. Neither is a Production integration call.

Local reproduction after installing Node 24, pnpm 11.19.0 and Git:

```sh
pnpm --dir tools/d1-readiness install --frozen-lockfile --ignore-scripts
node tools/d1-readiness/readiness.mjs
node --experimental-vm-modules tools/review-worker-candidate.mjs worker.txt
node --test tools/verify-worker-source.test.mjs
node tools/verify-worker-source.mjs
```

On Windows where Git is not on PATH, set the process-local `CARESTEP_GIT` to the
Git executable. This variable is used only to read the pinned local Git object.
The suite accepts no remote DB or deployment options. CI installs the same
locked dependency graph with lifecycle scripts disabled and runs these checks.

## Scenario results

| Local workerd/D1 scenario | Result |
| --- | --- |
| Fresh empty DB bootstrap, column/index/trigger ordering and composite PK | PASS |
| Fresh cold-module reinitialization, identical schema | PASS |
| Pinned main-era fixture lacks consult columns; original A.2 collision reproduced | PASS |
| Legacy upgrade, required objects, original rows/PK preserved, no backfill | PASS |
| Second legacy upgrade, identical schema and unchanged legacy evidence | PASS |
| Empty ledgerLastSeen with legacy-only data and foreign clinic v2 observations | PASS |
| Same record_key across clinics, repeated writes without cross-clinic overwrite | PASS |
| Actual nonempty sync-batch creates separate clinic patient maps and ledger rows | PASS |
| Actual retry-due resolves clinic A; B's queue and ledger remain identical | PASS |
| Actual retry-due reaches dead-letter on third total failure, scoped status | PASS |
| Actual guardian identity conflict quarantines only the affected clinic | PASS |
| Isolated A.2 rollback rehearsal reproduces legacy collision; v2 stays intact | PASS |
| Outbound deny guard verified; business paths made zero outbound requests | PASS |

**Additional D1 suite: 13 PASS / 0 FAIL.**
Existing regression suite: **19 PASS / 0 FAIL**.
Source-verifier unit suite: **4 PASS / 0 FAIL**, no skips.
Combined: **36 PASS / 0 FAIL** (32 behavioral/regression checks + 4 verifier tests).
Worker identity verification, syntax checks and `git diff --check` are separate
gates, not additional counted tests. CI records results for the final pushed
commit; check that run rather than relying on an older green commit.

### Fresh and upgrade details

Fresh schema declares consult columns in CREATE TABLE before their index;
it does not require ALTER for already-declared columns. The legacy fixture uses
the actual initializer at main commit
`26395b304c94ea40a016c44b2e815da828e91c75` and explicitly verifies both
`consult_status` and `consult_updated_at` are absent. Candidate ALTER statements
precede the dependent index. In both paths the patient table declaration
precedes the patient-delete trigger. Required index/trigger existence is checked.
The v2 table has PK columns ordered `(clinic_id, record_key)` and two explicit
supporting indexes. Each path repeats initialization from a separate module
and compares the full user schema before/after.

### Retention and clinic isolation

The legacy fixture deliberately creates the original defect using A.2 code:
clinic A writes a key, then B writes the same key, leaving one mixed-ownership
row. Candidate upgrade preserves the complete row and original PK metadata
without copying it into v2. This remains true through cold reinitialization
and new candidate v2 writes. Ownership is not inferred from damaged evidence.

With no local v2 observations, `ledgerLastSeen` is the empty string, even if
the legacy table has rows or clinic B has a v2 timestamp. Normal sync creates
independent patients for identical source IDs. Actual retry resolves A's
missing guardian case after a normal guardian sync; B's failure and ledger
snapshots remain identical. A's ledger/status advances to the retry observation.
Dead-letter and quarantine counts remain clinic-scoped.

The original 19-check suite additionally reconfirms all named functions and
schema tables are retained, plus checkpoint, reconcile, routes and core feature
preservation. This follow-up changes none of the 610 Worker function bodies.

## Rollback and unresolved operational risks

**A.2 code rollback is not a safe rollback.** The isolated rehearsal switches
only to the immutable A.2 module after v2 creation and reproduces the global-key
collision in the legacy table. This intentional synthetic legacy write happens
only in the separately labelled rollback test, after preservation assertions.
V2 survives, but old code neither reads nor updates its new observations.

No historical collision can be reconstructed from the surviving legacy row
alone. Any future historical promotion needs independently verified clinic
ownership/provenance and must not overwrite newer v2 observations. No automatic
backfill or FullReconcile is supplied or recommended to fill v2.

Local workerd/D1 success does not establish live D1 capacity, migration latency,
concurrent rollout behavior, all hospital-specific schema drift, permissions,
bindings or provider credentials. Live payment/SOLAPI/Kakao and Home/HQ/CRM
end-to-end smoke tests remain outside this task. Retaining v1 and v2 consumes
additional storage. Initial ledgerLastSeen emptiness must be understood by the
operator, and any still-running A.2 writer remains a collision risk.

## Not executed and manual approval gate

No main push/merge; no PR #4/#5 Ready transition or merge; no Cloudflare
Production deployment; no Production D1 migration/data mutation; no Production
FullReconcile; no Windows Agent change; no live Production integration call;
no Production secret/environment change. No Production execution commands
are included in this test package.

Before a separately authorized Production rollout, a human must:

- [ ] Review PR #5's corrective delta and this evidence against the final green CI head.
- [ ] Approve the no-backfill/legacy-retention policy and initial empty ledgerLastSeen behavior.
- [ ] Review backups and a recovery plan that does not label an A.2 code revert as safe.
- [ ] Confirm Production schema inventory/drift, v2 storage and CREATE permissions under a separately approved process.
- [ ] Approve deployment sequencing and exclusion of old A.2 writers; retain independent UI/Agent versions.
- [ ] Approve a scoped rollout and non-destructive health/status/normal scheduled sync and Home/HQ/CRM/provider smoke plan.
- [ ] Establish stop criteria, monitoring for retry/dead-letter/quarantine, and an explicitly reviewed recovery decision.

These checklist items remain open; a passing isolated gate does not complete them.
