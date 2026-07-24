# Owner Notes

PageMaker began as a reusable project frame. It now keeps the PageMaker application source separate from durable context so work can continue across devices and AI sessions.

## What The Folders Are For

- `project/`: the actual application, tool, library, site, automation, game, or service. Rename it only intentionally.
- `docs/`: durable project memory, AI handoff, workflow rules, setup guidance, and focused design/architecture notes.
- `asset_staging/`: raw/reference/transfer assets that are safe to synchronize but are not yet source assets.
- `local_assets/`: private or one-machine material. Its contents are ignored and AI should inspect it only when asked.
- `notes/`: your scratchpad and planning area. AI should not treat it as instructions unless you tell it to.
- `scripts/`: optional repeatable repository automation; this template includes only the safe-copy helper.

## Starting A Real Project

1. Create a clean copy with `scripts/New-AIProject.ps1` or a manual copy without `.git/` and local/generated folders.
2. Open the copied project in an AI session.
3. Ask it to read `AGENTS.md`, `docs/TEMPLATE_SETUP.md`, and `docs/NEW_PROJECT_CHECKLIST.md`.
4. Describe the project and let it inspect the actual source before deciding stack-specific rules.
5. During setup, tell the AI the desired Git display name and the one email verified/associated with the GitHub account that should receive attribution. Configure clone-local `user.name`, the matching `user.email`, `.git-identity`, and `.githooks` immediately after Git initialization—not only when the first commit is due.

## Owner Commands

### memcheck

Ask for `memcheck` when the AI should save the durable outcome of discussion and work: settled decisions, functionality, plans, constraints, commands, pitfalls, and shared vocabulary. It does not commit or push.

### gitcheck

Ask for `gitcheck` when the AI should perform `memcheck`, inspect and validate current work, confirm Git identity, stage intended files, commit with a useful title/bullets, and push unless you say not to.

### Delivery Commands

This general template intentionally does not define `localrelease`, deploy, publish, or packaging commands. Add one only after the real project has a documented process in `docs/DELIVERY_PROCESS.md`; then ask the AI explicitly to run it.

## Ground Rules

- Keep private data, credentials, exports, screenshots, and customer material out of Git.
- Ask before broad restructuring, deleting significant files, changing technology, or changing how the project is delivered.
- Ask AI to recommend first when you want options rather than immediate changes.
- Keep the template docs factual and current through `memcheck`; do not use them as full chat transcripts.
