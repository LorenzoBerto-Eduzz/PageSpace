# AI Handoff: PageSpace

## Current State

- The product has pivoted from PageMaker to `PageSpace`.
- The application, package metadata, executable, Windows app ID, UI, GitHub user agents, build
  folders, source repository, and OAuth App display identity now use PageSpace.
- The GitHub source repository is
  `https://github.com/LorenzoBerto-Eduzz/PageSpace`; local `origin` tracks it.
- The existing OAuth Client ID and Device Flow implementation were intentionally preserved.
- The previous local test pages, legacy application data, and both disposable GitHub test
  repositories were removed.
- Source remains in `project/`. The outer local directory still has the former name only because
  renaming an active Codex workspace should happen after this clean Git checkpoint.
- Private per-page metadata uses `.pagespace/`.
- The current starter application version is `0.1.0`.

## Implemented PageSpace Foundation

- `docs/PAGESPACE_PACKAGE_FORMAT.md` defines package contract v1.
- `pagespace-package-service.ts` validates safe manifests, static files, editable schemas, content,
  file types, limits, symlinks, and paths.
- Package modes are `static` and `editable`.
- Editable fields support text, textarea, URL, color, image, boolean, select, and repeatable
  collections.
- Editable websites read generated values through `window.PAGESPACE_CONTENT`.
- Imported packages never run privileged or arbitrary build commands.
- Package installation and updates use staging, atomic replacement, and stable package IDs.
- Compatible editable values survive updates by stable field key and type.
- User-selected images are decoded through Electron and re-encoded as PNG before storage.
- Baking copies validated static files, generates `pagespace-content.js`, includes approved user
  assets, hashes every output file, and atomically replaces prior output.
- Publication accepts the exact dynamic allowlist produced by the current verified generation.
- The Add Page modal currently presents two large starter tiles: left `Trazer página` and right
  `Criar página`. Their deeper workflows remain the next product-development focus.
- Page cards intentionally omit source-type labels to keep the dashboard visually quiet.
- App settings exposes one `Baixar instruções para IA (.txt)` action. It generates a handoff
  document from the currently installed PageSpace version and supported package contract.
- Existing GitHub Device Flow, protected storage, repository creation, retry, conflict detection,
  and Pages activation remain integrated.

## Validated Checkpoint

- Lint passes.
- Node and renderer TypeScript checks pass.
- Six test files and 45 tests pass.
- Production and unpacked portable builds pass.
- The review executable is `project/dist/PageSpace/PageSpace.exe`.
- The review build currently has an empty persistent `Pages/` folder.
- Tests cover package validation, executable rejection, editable content, user assets, baking,
  import, saving, compatible updates, simple creation, and dynamic publication paths.

## Next Product Milestone

Build and manually verify one complete disposable package lifecycle before using real colleague
data:

1. Import a minimal static package.
2. Import a minimal editable package.
3. Edit declared values and an image.
4. Bake and open the exact local output.
5. Replace the editable package with a compatible newer version and confirm user values survive.
6. Publish a disposable page, update it, and verify conflict handling.
7. Refine the two Add Page workflows from what this vertical slice reveals.
8. Use SotoDashboard as the first real colleague-facing package only after the disposable lifecycle
   is reliable.

## Durable Safety Decisions

- Every page begins local-only.
- Static packages are not structurally editable.
- Editable packages expose only author-declared controls.
- Ordinary arbitrary folders are not granted editing or privileged build behavior.
- Package code runs only as isolated browser content.
- PageSpace owns privileged filesystem, image, credential, Git, and GitHub operations.
- Only fresh verified generated output is public.
- Package defaults and private instance content remain separate so compatible template updates can
  preserve user edits.
- Local deletion never silently deletes a remote repository.
