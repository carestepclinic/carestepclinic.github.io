# CARESTEP Clinic v10.7-A — Data Integrity & Stabilization

## Finalization status

- Static regression/integrity QA: **25/25 PASS**
- JavaScript syntax: worker / patient-crm / patient-timeline **PASS**
- PowerShell static structure: braces / parentheses / brackets **PASS**
- Production `main`: **not modified by this branch**
- Remaining production gate: **one controlled Windows hospital-server smoke test**

## Verified release SHA-256

- `index.html` — `7b8f04e5a2b9b89e7f2f08c56d1f8d74275120c19ff89d94092592a669ac232a`
- `worker.txt` — `4eb57cb9432e10dc1c1fccf7eaac44cbb8fe69cf5cc340c31619792cf805a129`
- `patient-crm.js` — `9c0cddc43c0586661e2d028a7e17eb88d9437c212d3a9f3afc5fefe6105406d5`
- `patient-timeline.js` — `06b4a5d16cf59fb7b993a0682bd420fa476582a04487e5f64ecd466769fc874a`
- `CARESTEP_eFriends_Sync_Agent_v10_7_A.ps1` — `3cf685658a2c5ac3a924677f2fb71993df3fc62940c44f08f6375549eb701298`
- `Install-CARESTEP-eFriends-Agent-v10.7A.ps1` — `089d842f983707065aa71dd0c372196290aac89b7b7d5087e0ca7be9ea5b32cc`

## Verified base SHA-256

These hashes are the bases used to produce the release diff. Do not apply a patch if the target base differs.

- current GitHub `worker.txt` base used for stabilization diff — `75c4b9603a1151b0d10b7e5d97e0f795c1ec31f9b76fc630112bc114437e7d7c`
- v10.6-C `index.html` — `fe5092903283228c03d3ed9d86938cefc5e4c9c52e750214a0eeb47c7b57b109`
- v10.6-C `patient-crm.js` — `770f38871e63f2efcf47c9bd3039cbc9057666a0d878ca3cd71f185e9ac121ed`
- v10.6-C `patient-timeline.js` — `06b4a5d16cf59fb7b993a0682bd420fa476582a04487e5f64ecd466769fc874a`

## Release gates

1. Deploy `worker.txt` to the Cloudflare Worker in a controlled window.
2. Verify `/efriends/v1/health` returns v10.7-A and D1 access is healthy.
3. Install the v10.7-A eFriends Agent on the hospital Windows server.
4. Run one manual sync and confirm checkpoint, retry queue, quarantine, dead-letter and reconcile counters.
5. Verify one normal patient, one vaccination/heartworm schedule, one weight record, and one eFriends-linked patient status in Clinic UI.
6. Only after all five checks pass, resume the automatic scheduled sync.

## Rollback

- Worker: restore the prior v10.6-C Worker.
- Clinic UI: restore prior v10.6-C files.
- Windows Agent: point the scheduled task back to the prior v10.6-B.2 Agent.
- v10.7-A D1 safety tables may remain; older code does not depend on them.

## Merge policy

This PR is intentionally a **draft / release-candidate PR** until the Windows smoke test is completed. Do not merge solely on static QA.