# A.2.2 corrective PR gate

This branch must remain separate from PR #4 until review concludes.

Base: `fix/v10.7-worker-source-of-truth`

Do not merge to `main`, mark the parent PR ready, deploy Cloudflare Worker code, run a production D1 migration, run FullReconcile, change the Windows Agent, or modify production data as part of this corrective review.

The exact A.2 audit source in `incoming/worker-v10.7-A.2.txt` remains unchanged and is not relabeled as A.2.2.

PR #5 remains Draft. The current Worker SHA-256 is
`677e602440017e1ff781524e8da04b00044939ade6d66a4065cdfa0dbbdcc3c9`.
The [new assignment schema contract](worker-a2-2-assignment-contract.md) requires
fresh/legacy/partial/no-op/drift tests and new Production review. The earlier
A.2.1 hash/approvals do not apply. Do not resume SQL 07–32 automatically.
