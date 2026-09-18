# CARESTEP production source of truth

> **Regression gate BLOCKED (2026-09-08):** source identity passes, but offline
> SQLite tests reproduce cross-clinic ledger overwrite and old-schema upgrade
> failure (`consult_status`). Keep Draft; do not merge or deploy. See
> [the candidate review](docs/worker-a2-candidate-review.md). Static CI success
> does not override these failures.

The verified Cloudflare Worker v10.7-A.2 source has now been restored to the
repository **on the draft branch only**. Production has not been changed.

| Component | Production version reported on 2026-09-08 | Repository draft status |
| --- | --- | --- |
| Clinic UI | v10.7-A | Preserved from `main` |
| Cloudflare Worker | v10.7-A.2 | `worker.txt` synchronized to the verified deployed source on this branch |
| Windows eFriends Agent | v10.7-A.4 | Hospital installation unchanged |

Source identity is pinned to SHA-256:

`9f54ddd87f542e749cf0c070a292d7d56e11e0409895fc34d929740e4dbc21a7`

The audit copy `incoming/worker-v10.7-A.2.txt` is retained only for provenance
and byte-for-byte verification. **It is not a production deployment target.**
The repository root `worker.txt` is the deployment source after review and an
explicitly approved merge.

See [the source audit and deployment gates](docs/production-source-of-truth.md).
PR #2 remains a validation archive, not a production merge source. Historical
`README_HOTFIX*` and `README_DEPLOY_HOTFIX37.txt` instructions must not be used
as the next Worker deployment source.

Before any future Worker deployment, run with Node.js 24:

```sh
node tools/verify-worker-source.mjs
node --test tools/verify-worker-source.test.mjs
node --experimental-vm-modules tools/review-worker-candidate.mjs incoming/worker-v10.7-A.2.txt
```

The branch CI also downloads the pinned GitHub raw audit copy, verifies its
SHA-256, compares it with `origin/main`, checks regression markers, named
functions and schema preservation, and syntax-checks the Worker.

**No automatic production deployment is authorized by these checks.** Keep the
current hospital environment unchanged until this Draft PR is reviewed, merged
with explicit approval, and the separate manual production deployment gate is
approved. Do not run a D1 migration, reinstall the Agent, change scheduled
tasks, or run FullReconcile as part of repository hygiene.
