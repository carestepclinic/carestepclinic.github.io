# CARESTEP production source of truth

This is the **v10.7-A.2.3 corrective branch** for four reproduced P1 defects:
clinic ledger isolation, schema ordering, missing followup assignment columns,
and the missing preventive delivery cleanup trigger.
It is stacked on PR #4; PR #4 remains Draft/BLOCKED and the deployed Worker
remains A.2. This corrective change and its tests did not access Production.

| Component | Production | This corrective branch |
| --- | --- | --- |
| Clinic UI | v10.7-A | Unchanged |
| Worker | v10.7-A.2 | v10.7-A.2.3 corrective candidate |
| Windows eFriends Agent | v10.7-A.4 | Unchanged |

See [corrective design, migration and tests](docs/worker-a2-1-corrective.md).
The [preventive trigger contract](docs/worker-a2-3-preventive-trigger-contract.md)
adds safe creation, semantic no-op checking and drift rejection, retaining the
[assignment contract](docs/worker-a2-2-assignment-contract.md). Local validation is
**90 PASS / 0 FAIL** (19 regression + 13 D1 readiness + 14 assignment + 40 trigger + 4 verifier).
The undeployed A.2.2 candidate is preserved at commit
`c3ca52b186e5075fd712b233cf935b064a46e75c`; its approval hash does not authorize A.2.3.
The [A.2 source audit](docs/production-source-of-truth.md) and
[A.2 failure report](docs/worker-a2-candidate-review.md) remain historical
evidence for the immutable source preserved in PR #4.

The audit artifact `incoming/worker-v10.7-A.2.txt` remains unchanged at SHA-256:
`9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7`.
It is not a deployment target. The corrective root `worker.txt` has a distinct
reviewed identity and must not be described as the exact A.2 original.

With Node.js 24 and Git available:

```sh
node tools/verify-worker-source.mjs
node --test tools/verify-worker-source.test.mjs
node --experimental-vm-modules tools/review-worker-candidate.mjs worker.txt
pnpm --dir tools/d1-readiness install --frozen-lockfile --ignore-scripts
pnpm --dir tools/d1-readiness test
```

The corrective CI runs these checks as well as syntax and preservation checks.
The ledger migration adds v2 without copying, rewriting or deleting legacy
rows. Normal sync observations populate v2; no FullReconcile is needed.

**Manual production deployment required only after separate review and approval.**
Do not merge main or PR #4, deploy Cloudflare, run production D1 migrations,
change the Windows Agent/task, or modify production data in this task.
PR #2 and the old HOTFIX README files are historical and must not be used as
deployment or rollback instructions.
