# A.2.3 corrective PR gate

This branch must remain separate from PR #4 until review concludes.

Base: `fix/v10.7-worker-source-of-truth`

Do not merge to `main`, mark the parent PR ready, deploy Cloudflare Worker code, run a production D1 migration, run FullReconcile, change the Windows Agent, or modify production data as part of this corrective review.

The exact A.2 audit source in `incoming/worker-v10.7-A.2.txt` remains unchanged and is not relabeled as A.2.3.

PR #5 remains Draft. The current Worker SHA-256 is
`57c1076d2026e2d5d3a2632690d873041533d229847c3d3afc26bf850ca3076a`.
All three Worker constants are 10.7-A.2.3. The undeployed A.2.2 candidate is
preserved at commit `c3ca52b186e5075fd712b233cf935b064a46e75c` and its original hash.

The stacked delta now fixes four P1 contracts: clinic-scoped v2 ledger,
dependency ordering, assignment columns and preventive cleanup trigger creation.
Required gates: **90 PASS / 0 FAIL** (19 regression + 13 readiness + 14 assignment +
40 trigger + 4 verifier), syntax, exact identity, preserved functions/tables,
immutable A.2 hash and green CI on the pushed head.

The operator has confirmed the Production assignment contract and cleanup
trigger definition through earlier approved read-only checks. Trigger origin
in Git remains unknown; its verified behavior is now an explicit contract.
Matching existing trigger is no-op; mismatch blocks without DROP/replacement.
This code task makes no Production request or write. Raw logs and external
preflight tools are neither changed nor attached to this PR.

Next: separately review a new A.2.3 Phase 1C tool with 16 indexes and **8 triggers**,
then obtain new limited execution approval. Prior A.2.1/A.2.2 approvals do not
authorize A.2.3. Do not resume SQL 07–32, Ready/merge, migration or deploy.
