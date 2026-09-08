# CARESTEP v10.7-A.1 Windows Agent smoke-test hotfix

Hospital-server smoke test on 2026-09-08 exposed a Windows PowerShell automatic-variable collision in `CARESTEP_eFriends_Sync_Agent_v10_7_A.ps1`.

## Symptom
`PID 변수는 읽기 전용이거나 상수이므로 덮어쓸 수 없습니다.` at Build-Data patient/event loops.

## Root cause
PowerShell variable names are case-insensitive. `$PID` is a built-in read-only automatic variable containing the current PowerShell process id, so local `$pid` assignments are invalid.

## Fix
- Renamed all 27 patient-id local references from `$pid` to `$patientExternalId`.
- Agent header version changed from `10.7-A` to `10.7-A.1`.
- Worker/API version remains `10.7-A`; no API protocol or schema change is required.
- eFriends source behavior remains backup-only/read-only.
- No production data write occurred in the failing smoke run because execution stopped during local `Build-Data` before Sync API submission.

## Static verification after hotfix
- Reserved `$PID` token remaining: 0
- `{}` balance: PASS
- `()` balance: PASS
- `[]` balance: PASS
- `DryRun`, `Force`, `FullReconcile`: preserved
- Patched Agent SHA-256: `75d2729822098afb91100373a251a1635aecfcb0a1b7f8f0a58422e574e579b1`
- Hotfix ZIP SHA-256: `58fe525cbd6759457c3cad09dbfb1afc895d778f42a9f59747c134eb485feaa8`

## Release gate
Repeat the controlled hospital-server smoke test with `-DryRun -Force`. Do not merge/deploy the release candidate until that rerun passes and one controlled real sync verifies API health, checkpoint, retry/quarantine/dead-letter and reconcile behavior.
