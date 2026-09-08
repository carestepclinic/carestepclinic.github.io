# CARESTEP Worker v10.7-A.2.1 regression results

Corrective code commit: `8929c49` (`fix: correct A.2.1 P1 regressions`).

Candidate SHA-256:

`5b4e5661c6607e4042964300fcc4d5086565f431439a814dc10d06f3438f3487`

Offline GitHub Actions validation uses Node 24, `node:sqlite`, synthetic fixture data and no production services.

## Behavioral gate

`CARESTEP_REVIEW_MODE=corrective node --experimental-vm-modules tools/review-worker-candidate.mjs worker.txt`

Result: **14 PASS / 0 FAIL**.

Passing checks include:

- corrective source differs from exact A.2 and all Worker component versions are `10.7-A.2.1`
- all main-era named functions retained
- core payment / Toss, SOLAPI OAuth, Kakao, password/session and encryption implementation preservation
- existing literal routes retained
- eFriends health auth and reviewed version
- HQ master auth rejection/acceptance behavior
- reconcile eligible counts, missing/extras semantics and clinic scope
- monotonic clinic-scoped checkpoint
- ambiguous guardian matching quarantine
- third recorded failure becomes dead-letter
- same external patient ID across clinic-A and clinic-B produces two isolated ledger v2 rows
- old main-era schema upgrades without `consult_status` ordering failure
- fresh schema initialization creates consultation columns and dependent index
- legacy v1 ledger row is copied to v2 without deleting or rewriting the v1 row

## Syntax and safety

- Worker `node --check`: PASS
- review tool `node --check`: PASS
- destructive ledger DROP/DELETE scan: PASS
- exact A.2 audit source remains unchanged on parent branch

No Cloudflare deployment, production D1 migration, FullReconcile, Windows Agent change or production data write was performed.
