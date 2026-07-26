# AI Handoff: PageMaker

## Current State

- Project name: `PageMaker`.
- Product: `Business-grade Windows desktop app for managing local-only and explicitly published static websites`.
- Source: `project/` contains the Electron + electron-vite + React + TypeScript scaffold and the approved static dashboard foundation.
- Confirmed stack: `Electron + electron-vite + React + TypeScript`.
- Local state: `versioned JSON files under Electron userData`; no cloud sync or database in the MVP. Secrets use protected OS storage, never normal JSON.
- Run command: `cd project; npm run dev`.
- Validation: `cd project; npm run lint`, `npm run typecheck`, and `npm run build`.
- Development review build: `cd project; npm run build:unpack`, which refreshes the owner's portable folder at `project/dist/PageMaker/` while preserving `Pages/`.
- Clean colleague handoff: `cd project; npm run export:localrelease`, which refreshes the development build first and creates `project/dist/localrelease/PageMaker/` with an empty `Pages/` and no local user/developer data.
- Delivery: `localrelease` is approved for clean, repeatable colleague handoff folders after completed app milestones. An uploaded/public release is not approved yet.
- Git: `initialized on main`; local identity is configured and the `.githooks` email guard is enabled. The real `.git-identity` is local-only and ignored.
- Remote: `none configured yet`; initial setup is a local root commit only.
- Durable context is in `docs/`; `notes/` is owner scratch space; `asset_staging/` accepts Git-safe references; `local_assets/` remains private and ignored.

## User Intent

The owner wants PageMaker to be a portable, friendly, business-grade desktop control center for non-technical users. Each user manages multiple website cards, which begin local-only. Users can edit and preview safely, then explicitly choose to publish an individual site online without seeing Git mechanics.

## Working Procedure For Future AI Sessions

1. Read `AGENTS.md`, this handoff, the memory protocol, workflow/style guidance, and the project brief.
2. Read the organization document before architecture or structural work; inspect the real source before editing.
3. Preserve the boundary: main/preload own privileged access, renderer owns UI, public templates contain no private/editor material.
4. Read `docs/SECURITY_AND_PUBLISHING_MODEL.md` before changing local storage, authorization, exports, generated output, or publishing behavior.
5. In a new clone, read `docs/COPYING_AND_GIT.md`, configure that clone's Git identity, create its local `.git-identity`, and enable `.githooks` before committing.
6. Before creating a package, installer, release, export, deployment, or public publish, read `docs/DELIVERY_PROCESS.md` and obtain explicit owner authorization.

## Suggested Near-Term Next Steps

- Define and validate the versioned local-only card/data model, including explicit deployment state and migration/version fields.
- Implement a narrow main/preload IPC contract and an atomic local configuration store before making the dashboard interactive.
- Build the first create-card flow and a focused editor shell backed by that local model.
- Implement and verify the sanitized static `links-hub-v1` generator, then local preview/ZIP export.
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
- The static visual foundation uses a light PT-BR `Minhas Páginas` dashboard with a subtle smoky blue/gold background, a maximized light-theme Windows window, one empty placeholder card, and a compact square plus control. The card preview is intentionally blank; its labels are placeholders only.
- Cards use a common soft-gray contour and consistent corner radius. The whole card is the future editor-entry target; its local/private and settings icon controls remain independently targetable. No dashboard action has business behavior yet.
- Full-screen dashboard layout is prepared for four card columns/two rows. The dashboard content area owns a thin, light-gray internal scrollbar aligned under the global settings control when more rows overflow.
- `project/dist/PageMaker/` is the owner's stable development-review target. Refresh it after each completed user-visible app change or milestone, preserve its `Pages/`, and run its `PageMaker.exe` to review the latest build.
- Local app configuration uses versioned JSON under Electron's `userData` location, not a cloud service or database.
- In a packaged build, `Pages/` sits beside `PageMaker.exe`. Each real card owns a stable subfolder named from the PT-BR creation name, with a local `.git` repository, `assets/`, and private `.pagemaker/page.json` metadata. Rebuilding the app preserves `Pages/`; a future dashboard rename changes only the displayed card name, not the folder/Git location.
- Creating a page is functional: the modal asks for a PT-BR name and optional description, then atomically creates the folder and initializes local Git without requiring system Git or GitHub. Creation requests are serialized and duplicate form submits are blocked.
- `localrelease` means the clean shareable folder at `project/dist/localrelease/PageMaker/`, not the owner's populated development copy. It has the same structure as the future downloadable portable app, but its `Pages/` is always empty and it contains no local settings, page metadata, credentials, or developer/user content. Never deliver `project/dist/PageMaker/` to a colleague.
- Editable content uses a future-extensible ordered pages/elements model. The initial UI exposes only hero/text/section-card-grid editing.
- `Salvar e Postar` writes/generates/publishes only the active website card. Never make empty commits or automatically resolve merge conflicts.
- The repository, not chat memory, is the source of truth. `memcheck` writes durable memory only; `gitcheck` validates, commits, and pushes only on request.
