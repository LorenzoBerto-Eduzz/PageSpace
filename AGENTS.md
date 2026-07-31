# Agent Boot Instructions

This is the first file an AI coding session should read in PageSpace.

## PageSpace Context

PageSpace is a portable Windows Electron application with source in `project/`. It is a local
workspace for creating simple pages and importing AI-authored website packages, viewing them
locally, editing only package-declared content, baking verified public output, and explicitly
publishing individual pages through the user's connected GitHub account.

The repository, not prior chat memory, is the continuity source.

## Boot Or Catch-Up Sequence

1. Read `docs/AI_HANDOFF.md`.
2. Read `docs/AI_MEMORY_PROTOCOL.md`.
3. Read `docs/WORKFLOW_AND_STYLE.md`.
4. Read `docs/PROJECT_BRIEF.md` when purpose, stack, commands, or constraints matter.
5. Read `docs/PROJECT_ORGANIZATION.md` before structural or architecture changes.
6. Read `docs/SECURITY_AND_PUBLISHING_MODEL.md` before changing imports, storage, assets,
   generation, authorization, exports, or publishing.
7. Read `docs/PAGESPACE_PACKAGE_FORMAT.md` before changing package compatibility, editable
   schemas, AI authoring instructions, baking, or package updates.
8. Read `docs/COPYING_AND_GIT.md` before changing Git identity, remotes, or repository setup.
9. Read `docs/DELIVERY_PROCESS.md` before packaging, releases, exports, or deployments.
10. Read `docs/OWNER_NOTES.md` when changing repository organization or owner guidance.
11. Check `git status --short --branch`.
12. Review `git log --oneline --decorate --max-count=10`.
13. Inspect the relevant real source before editing.
14. Before a commit or push, verify `.git-identity`, clone-local Git name/email, and
    `core.hooksPath`.

## Safety And Working Rules

- Preserve user changes and owner scratch material in `notes/`.
- Do not make broad rewrites, moves, deletions, framework changes, or deployment changes without
  owner confirmation.
- Do not commit, push, release, package, export, or deploy unless explicitly requested.
- Do not update durable docs for ordinary changes. Update them for `memcheck`, documentation work,
  or changes whose scope specifically includes product architecture or workflow.
- Never commit customer data, credentials, tokens, private screenshots, identifiers, or private
  exports.
- Imported packages are untrusted. Never execute package-provided programs, shell commands, npm
  scripts, build scripts, or privileged code.
- Publish only freshly baked and verified output.

## Repository Frame

```text
PageSpace/
  project/               Electron application source
  asset_staging/         Git-safe references and transfer assets
  local_assets/          ignored local-only material
  docs/                  durable product and AI memory
  notes/                 owner scratch space
  scripts/               repeatable repository automation
  AGENTS.md
  README.md
```

The local root folder may temporarily retain the previous `PageMaker` directory name until this
clean Git checkpoint is completed and Codex can reopen the workspace from its new path.

## Product Boundaries

- Every card starts local-only.
- `Criar página` uses the built-in basic editor.
- `Trazer página` imports either an ordinary browser-ready website or a PageSpace package.
- Ordinary websites support organization, local viewing, source-folder refresh, and publishing
  without an automatic edit form.
- Static packages support organization, local viewing, replacement, and publishing.
- Editable packages additionally declare a generated edit form and safe content-baking contract.
- An ordinary folder without the PageSpace contract cannot receive structural editing
  automatically.
- The renderer has no filesystem, Git, shell, token, or privileged package access.
- The Electron main process owns validation, storage, generation, GitHub, Git, dialogs, and
  external URLs through narrow preload IPC.
- Only public static output is published. Packages, edit schemas, private content state, metadata,
  previews, backups, credentials, and local paths remain private.

## Owner Workflow Commands

- `memcheck`: update durable project memory without committing or pushing.
- `gitcheck`: perform `memcheck`, inspect diffs, run relevant checks, verify Git identity, stage,
  commit with an objective title and bullet details, and push unless the owner says not to.
- After a completed user-visible milestone, refresh `project/dist/PageSpace/` while preserving
  `Pages/`, unless the owner says not to.
- `localrelease`: create `project/dist/localrelease/PageSpace/` with an empty `Pages/` folder and no
  local data. Follow `docs/DELIVERY_PROCESS.md`.
