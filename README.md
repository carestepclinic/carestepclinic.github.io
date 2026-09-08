# CARESTEP production source of truth

**Worker deployment is blocked: `worker.txt` is still v10.5-A.** The reported
production Worker is v10.7-A.2. Copying the current repository Worker into
Cloudflare would roll back production behavior.

| Component | Production version reported on 2026-09-08 | Repository status |
| --- | --- | --- |
| Clinic UI | v10.7-A | Preserved from main |
| Cloudflare Worker | v10.7-A.2 | Exact source still required |
| Windows eFriends Agent | v10.7-A.4 | Installed on hospital server; source not restored here |

See [the source audit and deployment gates](docs/production-source-of-truth.md).
PR #2 is a validation archive, not a production merge source. Historical
`README_HOTFIX*` and `README_DEPLOY_HOTFIX37.txt` instructions are historical
only and must not be used for the next production deployment.

Before considering a Worker deployment, run with Node.js 24:

```sh
node tools/verify-worker-source.mjs
node --test tools/verify-worker-source.test.mjs
```

The first command deliberately fails until the recorded A.2 Worker source is
restored. A passing hash check establishes source identity against the archived
release hash; it does not replace regression review or production smoke tests.
It cannot prevent someone from manually bypassing the check in Cloudflare.

**Manual production deployment required**, after source restoration, review,
and merge approval. Do not deploy, merge, reinstall the Agent, change scheduled
tasks, or run FullReconcile as part of this preparation.
