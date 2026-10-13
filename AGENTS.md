# CARESTEP UI deployment

## Scope and authorization

- This repository publishes the Clinic/Home frontend through the existing GitHub Pages branch deployment. Keep that publishing configuration.
- When the user explicitly asks to implement and deploy a UI change, complete the edit, focused checks, GitHub commit, and deployment verification without requiring them to download and upload files.
- A question, review request, or request for a local candidate alone is not deployment authorization. Do not enable unattended edits or scheduled deployments.
- UI deployment does not authorize Cloudflare Worker uploads, D1 migrations/data changes, feature-flag changes, R2 changes, or real patient messages. Obtain separate task-specific approval for those operations.
- `worker.txt` is not a frontend deployment target. Do not treat it as the current deployed Worker source.

## Routine

1. Read the current `main` head and the exact files relevant to the requested change. Preserve unrelated changes; do not use old chat attachments as the deployment baseline.
2. Make only the requested change. Run the focused behavior tests and `node tools/check-ui.mjs <changed UI files>`. The syntax checks do not replace behavior tests.
3. Use the configured GitHub connection, or normally configured Git credentials. Never request tokens in chat or store credentials, patient records, approval artifacts, or execution logs in this public repository.
4. Commit only the approved files. For Git Data API updates, build from the inspected base tree, use that head as parent, and update `main` with `force=false` and the expected old SHA. Stop if the head has moved or a permission/protection rule blocks the operation. Honor required pull requests and checks; do not bypass them.
5. Find the `pages build and deployment` run for that exact commit. Report failed, pending, or unavailable status honestly. Never retry a mutation merely because a response is unclear; first read its state.
6. When permitted network access is available, run `node tools/verify-ui.mjs <changed UI files>` against the exact committed local bytes. This performs only public GETs. If access is unavailable, report Pages success separately from public-byte verification instead of claiming both.
7. For PWA/cache changes, perform the relevant browser refresh/update check. A published file match does not prove that an already-open browser has loaded it.
8. Report the commit link, changed files, check result, and Pages/public-byte result briefly. No new numbered release package, custom approval.json, expiring execution window, or bulk historical revalidation is needed for this routine. Existing historical approvals remain untouched and must not be reused.

## Recovery

- Preserve Git history. If an application regression needs rollback, describe the target commit and effects and obtain approval; use a revert commit, not a force push.
- These helper scripts do not deploy anything themselves. The configured GitHub connection performs authorized commits, and the existing Pages workflow publishes them.
- No Cloudflare credentials or additional OpenAI API key are required for this frontend-only route.
