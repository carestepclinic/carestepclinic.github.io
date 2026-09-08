# CARESTEP Worker v10.7-A.2.1 corrective P1 hotfix

This branch is a corrective candidate derived from the verified deployed A.2 source.
It is **not** the exact A.2 artifact and must never reuse the A.2 SHA-256 label.

## Source and target

- Base audit source: `incoming/worker-v10.7-A.2.txt`
- Base A.2 SHA-256: `9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7`
- Target Worker version: `10.7-A.2.1`
- Candidate SHA-256: `5b4e5661c6607e4042964300fcc4d5086565f431439a814dc10d06f3438f3487`

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
