# CARESTEP v10.7-A.2 — Reconcile Scope Hotfix

Hospital smoke test on 2026-09-08 confirmed actual manual sync succeeded: API v10.7-A, one event candidate processed safely as deduplicated, retry=0, deadLetter=0.

The remaining `reconcile differences=5` was identified as a scope-comparison false positive, not five confirmed missing datasets:
- source event totals counted all extracted rows,
- normal sync only sends active-patient/valid rows,
- heartworm additionally skips package rows,
- visit source count uses `visitSyncFrom` while CARESTEP retains older eFriends visit history,
- negative differences represent intentional retained historical/legacy data.

A.2 changes:
- Agent reports `sourceEligibleWeights`, `sourceEligibleVisits`, `sourceEligibleVaccinations`, `sourceEligibleHeartworm`.
- Worker reconcile prefers eligible source counts.
- only positive differences are treated as missing-data alerts;
- negative differences are retained in `extras` for information and do not set attention.
- v10.7-A.1 `$PID` Windows fix remains included.

Release gate:
1. Deploy A.2 `worker.txt`.
2. Verify `/efriends/v1/health` returns `10.7-A.2`.
3. Run A.2 Agent `-DryRun -Force` and inspect eligible counts.
4. Run one controlled `-Force` sync to refresh reconcile snapshot.
5. Do not use `-FullReconcile` just to clear legacy count differences.

A.2 ZIP SHA-256: `04edb036b2d43a493b0b2863938f20b16540e8846d0b737bd39a0933ec364f63`
A.2 Agent SHA-256: `f1b94d704acf505b4448c411ed1e25236d75bbb5c0a24c2cd66d3c8c55b96774`
A.2 Worker SHA-256: `9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7`
