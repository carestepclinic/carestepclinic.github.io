# CARESTEP production source of truth

**Worker deployment is blocked: `worker.txt` is still v10.5-A.** The reported
production Worker is v10.7-A.2. Copying the current repository Worker into
Cloudflare would roll back production behavior.

| Component | Production version reported on 2026-09-08 | Repository status |
| --- | --- | --- |
| Clinic UI | v10.7-A | Preserved from main |
| Cloudflare Worker | v10.7-A.2 | Exact source hash verified; replacement blocked by two regression failures |
| Windows eFriends Agent | v10.7-A.4 | Installed on hospital server; source not restored here |

See [the source audit and deployment gates](docs/production-source-of-truth.md).
The supplied A.2 source now matches the expected raw SHA-256. Its ledger clinic
isolation and upgrade ordering checks fail; see the
[candidate review](docs/worker-a2-candidate-review.md). The user's replacement
gate requires both identity and regression checks to pass, so `worker.txt`
remains unchanged. The supplied `incoming/` file is local review material and
has not been added to Git.
PR #2 is a validation archive, not a production merge source. Historical
`README_HOTFIX*` and `README_DEPLOY_HOTFIX37.txt` instructions are historical
only and must not be used for the next production deployment.

Before considering a Worker deployment, run with Node.js 24:

```sh
node tools/verify-worker-source.mjs
node --test tools/verify-worker-source.test.mjs
```

The first command still fails for the unchanged root Worker. To reproduce the
candidate regression gate, also run:

```sh
node --experimental-vm-modules tools/review-worker-candidate.mjs incoming/worker-v10.7-A.2.txt
```

It exits 1 for the two reproduced failures. It uses only in-memory SQLite and
the pinned main Git blob; it never connects to production. A passing hash check
establishes source identity against the archived
release hash; it does not replace regression review or production smoke tests.
It cannot prevent someone from manually bypassing the check in Cloudflare.

**Manual production deployment required**, after source restoration, review,
and merge approval. Do not deploy, merge, reinstall the Agent, change scheduled
tasks, or run FullReconcile as part of this preparation.
