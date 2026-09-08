# v10.7-A.4 Reconcile Final Hotfix

Hospital verification confirmed that the remaining vaccination reconcile delta was not missing data:

- eligible vaccination CSV rows: 6268
- unique vaccination sourceRef values: 6256
- CARESTEP vaccination records: 6256
- duplicate source rows: 12

Conclusion: the 12-row gap was a reconcile counting false positive caused by counting eligible CSV rows instead of unique vaccination sourceRef values.

A.4 change (Windows Agent only):
- `sourceEligibleVaccinations` now counts unique vaccination sourceRef values.
- Event transmission/mapping behavior is unchanged.
- Cloudflare Worker remains `v10.7-A.2`.
- Do not use `-FullReconcile` for this correction.

Verification:
- Agent version: `10.7-A.4`
- UTF-8 BOM preserved
- `$PID` references: 0
- backslash-escaped quote sequences: 0
- Agent SHA-256: `0089820AB80ED75D5767820F23DAE524980C4BD0810FC73DBF26E5E1633492BA`
- ZIP SHA-256: `0CFE06C61AD57B9A8906997BE2F8D2610F51B5FC489750B5163B8846DFF5F5D0`

Release gate:
1. extract A.4 Agent to a fresh Windows test folder
2. parser test => `0`
3. A.4 `-DryRun -Force` => `sourceEligibleVaccinations 6256`
4. run reconcile-only POST with A.4 counts => expected `differences: 0`, `status: ok`
5. install scheduled Agent
6. mark PR ready and merge
