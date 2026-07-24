# AI Handoff: PageMaker

## Current State

- Project name: `PageMaker`.
- Product: `Business-grade Windows desktop app for managing local-only and explicitly published static websites`.
- Source: `project/` (not scaffolded yet; it intentionally contains only the source-root keeper file).
- Confirmed stack: `Electron + electron-vite + React + TypeScript`.
- Local state: `versioned JSON files under Electron userData`; no cloud sync or database in the MVP. Secrets use protected OS storage, never normal JSON.
- Run/test commands: `unknown until the Electron scaffold is created`.
- Delivery: `Windows installer or portable .exe is the target; no package/release command is approved yet`.
- Git: `initialized on main`; local identity is configured and the `.githooks` email guard is enabled. The real `.git-identity` is local-only and ignored.
- Remote: `none configured yet`; initial setup is a local root commit only.
- Durable context is in `docs/`; `notes/` is owner scratch space; `asset_staging/` accepts Git-safe references; `local_assets/` remains private and ignored.

## User Intent

The owner wants PageMaker to be an installable, friendly, business-grade desktop control center for non-technical users. Each user manages multiple website cards, which begin local-only. Users can edit and preview safely, then explicitly choose to publish an individual site online without seeing Git mechanics.

## Working Procedure For Future AI Sessions

1. Read `AGENTS.md`, this handoff, the memory protocol, workflow/style guidance, and the project brief.
2. Read the organization document before architecture or structural work; inspect the real source before editing.
3. Preserve the boundary: main/preload own privileged access, renderer owns UI, public templates contain no private/editor material.
4. Read `docs/SECURITY_AND_PUBLISHING_MODEL.md` before changing local storage, authorization, exports, generated output, or publishing behavior.
5. In a new clone, read `docs/COPYING_AND_GIT.md`, configure that clone's Git identity, create its local `.git-identity`, and enable `.githooks` before committing.
6. Before creating a package, installer, release, export, deployment, or public publish, read `docs/DELIVERY_PROCESS.md` and obtain explicit owner authorization.

## Suggested Near-Term Next Steps

- Scaffold Electron + electron-vite + React + TypeScript in `project/`; document real run/test/lint/build commands.
- Define the versioned local-only card/data model, including an explicit deployment state.
- Implement and verify the sanitized static `links-hub-v1` generator and local-only preview/ZIP export path.
- Build global GitHub authorization, then the explicit `Publicar online` flow that creates a repo, configures Pages, and publishes only the chosen card.
- Add importing/connecting an existing repository as a secondary advanced flow.
- Update this handoff with `memcheck` after material decisions or implementation milestones.

## Durable Decisions

- PageMaker is a local private desktop app; a website card is one managed site; the public website is a separate static, viewer-only output.
- Every website card starts `local-only`: no remote, public URL, or external publishing is created until the user explicitly chooses `Publicar online`.
- A global GitHub account connection is required for online publishing. Authorization occurs through a secure browser flow; credentials/tokens must use protected OS storage and never normal configuration, logs, remote URLs, or public output.
- Online publishing creates/configures the selected card's repository and GitHub Pages deployment. Existing-repository import remains a secondary advanced option.
- Public output uses a strict allowlist/manifest: only selected page elements, intentionally placed assets, and fixed template files may be generated or exported. Images are sanitized to remove metadata such as EXIF/GPS by default.
- Local-only cards can be exported as sanitized static ZIPs. This is not the same as future authenticated private online hosting.
- Electron desktop is the primary application form. A localhost/browser interface may be added later only behind a loopback-only, authenticated local service.
- The renderer uses React; `electron-vite` is the application scaffold; `electron-builder` is the planned Windows packager once release work begins.
- Local app configuration uses versioned JSON under Electron's `userData` location, not a cloud service or database.
- Editable content uses a future-extensible ordered pages/elements model. The initial UI exposes only hero/text/section-card-grid editing.
- `Salvar e Postar` writes/generates/publishes only the active website card. Never make empty commits or automatically resolve merge conflicts.
- The repository, not chat memory, is the source of truth. `memcheck` writes durable memory only; `gitcheck` validates, commits, and pushes only on request.
