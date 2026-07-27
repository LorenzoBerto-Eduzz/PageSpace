# AI Handoff: PageMaker

## Current State

- Project name: `PageMaker`.
- Product: `Business-grade Windows desktop app for managing local-only and explicitly published static websites`.
- Source: `project/` contains the Electron + electron-vite + React + TypeScript application, functional local dashboard, and first local visual editor.
- Confirmed stack: `Electron + electron-vite + React + TypeScript`.
- Local state: each portable page workspace stores versioned public content plus private `.pagemaker/` metadata under `PageMaker/Pages/`; future global machine settings may use Electron `userData`. There is no cloud sync or database in the MVP. Secrets use protected OS storage, never normal JSON.
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

- Implement the first explicit per-page `Publicar online` flow against the connected personal GitHub account, using a disposable test page/repository first.
- Publish only verified generated files, persist resumable per-page repository/deployment state, and keep local saves successful even when network publication fails.
- Add per-page publishing settings and an explicit confirmation screen. For the first version, `Publicar online` creates a public repository by default.
- Create/configure the selected repository and GitHub Pages deployment, then commit and push only generated public output. A configured public page uses `Salvar e Postar`.
- Verify a clean colleague-ready `localrelease` with an empty `Pages/`.
- Defer richer element families, ZIP export/import, and broader folder management until the publishing MVP is reliable.

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
- A transient creation failure receives one short internal retry. Preview generation is best-effort and cannot turn an otherwise successful page creation into a failure.
- Every new page starts with a plain white canvas, independent left/right margins, positional vertical gaps, and one ordinary single-line title element containing the original creation name.
- The versioned content model currently supports ordered title elements. Users can directly edit, add, delete, and pointer-drag them; positional gap sizes remain in place when elements reorder.
- The movable editor panel contains app/meta controls. View mode hides editor chrome except the pencil control; save-state handling protects unsaved work on return and window close.
- Saving persists validated content, refreshes a clean private `.pagemaker/preview.png` without flashing the live editor, and moves the card to the front. A newly created card initially appends where the create control was.
- Every creation/save generates a clean static site under private `.pagemaker/generated-site/`. The output currently contains only verified `index.html` and `styles.css`; a private hash manifest remains outside the publishable directory. Generation uses a fresh temporary directory, strict file allowlisting, integrity verification, atomic replacement, and rollback protection.
- Dashboard previews are captured from the exact generated static site, keeping local review and future published rendering on one source of truth.
- The same centered page-settings modal opens from a dashboard card or the editor panel. It edits dashboard-only name/description metadata, shows the permanent original folder name, opens the validated page folder in Explorer, and moves local deletion to the Windows Recycle Bin after separate confirmation.
- A dashboard metadata rename never renames the stable folder, changes its local Git identity, or alters website elements.
- Local deletion never implies remote deletion. A future published-page flow must present local removal and destructive GitHub repository deletion as distinct explicit choices.
- Every healthy page keeps exactly one validated previous snapshot containing both `data.json` and `.pagemaker/page.json`. Existing pages receive an initial snapshot during inspection; every later durable content or metadata change replaces it with the immediately previous valid pair.
- A damaged page remains visible on the dashboard with a red warning state. Any card interaction opens the recovery warning instead of the editor/settings. Recovery is explicit, validates the backup pair, restores it, regenerates the clean site, and attempts to rebuild the preview. Questionable files are never overwritten automatically.
- The global app-settings modal shows app version `v0.0.0`, total/damaged page counts, opens the portable `Pages/` folder, rescans external folder changes, rebuilds replaceable output, lists damaged pages, and truthfully shows GitHub as not linked.
- All current modals share a reusable top-right X close control. Close/cancel footer actions were removed where the X represents the same operation.
- Current visual composition is deliberately provisional. Layout, grouping, styling, icons, labels, and button placement must remain modular and easy to replace as product design evolves. Functional services and domain mechanics must not depend on the current frontend arrangement.
- PageMaker is registered as a GitHub OAuth App with Device Flow enabled. Its public Client ID is safe to ship; no client secret exists in the desktop application.
- Any unknown user can link their own personal GitHub account through PageMaker Settings. The temporary code is copied automatically, remains clickable to copy again, and the GitHub device page can be reopened. Linking can be explicitly cancelled; an external browser-tab close cannot be detected by Device Flow.
- GitHub authorization requests only `public_repo`. PageMaker receives no GitHub password and never asks users to create or paste access tokens.
- The OAuth token remains in Electron's main process and is encrypted at rest with Windows DPAPI through Electron `safeStorage`. Renderer code receives only the validated account profile.
- The connected GitHub account persists across PageMaker runtime updates for the same Windows user/application identity. It is not portable to another Windows user or computer and is never included in `localrelease`.
- Local pages persist across in-place runtime updates because the updater/build must preserve the sibling `Pages/` directory. A fresh PageMaker copy in a different folder intentionally sees that folder's own `Pages/`.
- A future built-in updater must stage and verify new runtime files, replace only application runtime, never mutate `Pages/`, preserve protected account state, and roll back runtime replacement on failure.
- Browser spellchecking is disabled on PageMaker editing surfaces so user text is not marked with red spelling underlines.
- `localrelease` means the clean shareable folder at `project/dist/localrelease/PageMaker/`, not the owner's populated development copy. It has the same structure as the future downloadable portable app, but its `Pages/` is always empty and it contains no local settings, page metadata, credentials, or developer/user content. Never deliver `project/dist/PageMaker/` to a colleague.
- Editable content uses a future-extensible ordered elements model. The current UI deliberately exposes only the foundational title element; the plus control is temporary rather than the final element-library UX.
- The first colleague-usable version prioritizes solid local organization/editing and explicit GitHub publishing. Additional elements and ZIP export come afterward.
- `Salvar e Postar` writes/generates/publishes only the active website card. Never make empty commits or automatically resolve merge conflicts.
- The repository, not chat memory, is the source of truth. `memcheck` writes durable memory only; `gitcheck` validates, commits, and pushes only on request.
