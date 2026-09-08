# CARESTEP v10.7-A.3 — Windows Agent Smoke Hotfix

Hospital smoke test on 2026-09-08 exposed a PowerShell logging-expression bug after A.2 reconcile logic passed DryRun.

## Symptom
During controlled `-Force` sync, execution stopped before the event API submission with:

`'\ · 체크포인트 $start 건부터 재개\' 용어가 cmdlet...` 

The failing expression used backslash-escaped quotes (`\"`) inside PowerShell string subexpressions. PowerShell does not use backslash as its quote escape in this context.

## Safety impact
- eFriends backup extraction had completed read-only.
- guardians/patients had 0 changes.
- event submission had not started when the exception occurred.
- Therefore the failed A.2 smoke attempt did not write the candidate event to CARESTEP.

## Fix
Agent v10.7-A.3:
- removes all `\"` quote escapes from checkpoint/progress logging;
- precomputes `$checkpointNote` / `$errorNote` before `Write-Log` calls;
- preserves A.2 eligible-count reconcile semantics;
- preserves UTF-8 BOM for Windows PowerShell 5.1;
- contains no `$PID` automatic-variable collisions.

## Hash
Agent SHA-256:
`F12B810A32431681997A5BE1BD23683D89DC30D6DF6F053FBBB12BADE838120F`

A.3 hotfix ZIP SHA-256:
`F1122AF8D8B77EE668D66F37F04660DEC0E65D161A07E4AC6257D85605379483`

## Release gate
Cloudflare Worker stays v10.7-A.2. Only the Windows Agent is updated to A.3.

1. Parse-test Agent on hospital Windows server (`errors.Count == 0`).
2. `-DryRun -Force` must complete.
3. One controlled `-Force` sync must complete.
4. Inspect reconcile, retry, deadLetter, quarantine/checkpoint output.
5. Only then install the scheduled Agent and merge the production PR.
