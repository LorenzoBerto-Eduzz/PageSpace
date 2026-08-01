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
- Source remains in `project/`. The outer local directory intentionally retains the former name
  while the active Codex task is associated with that path. This is cosmetic and must not be
  treated as pending product work. Rename only through a deliberate new-workspace handoff after a
  clean pushed checkpoint; reopen the renamed folder and recover from `AGENTS.md` and this file.
- Private per-page metadata uses `.pagespace/`.
- The current starter application version is `0.1.0`.

## Implemented PageSpace Foundation

- `docs/PAGESPACE_PACKAGE_FORMAT.md` defines package contract v1.
- `pagespace-package-service.ts` validates safe manifests, static files, editable schemas, content,
  file types, limits, symlinks, and paths.
- Package modes are `static` and `editable`.
- `Trazer página` also accepts ordinary browser-ready websites without a manifest. It detects a
  root/common-output entry, a unique nested `index.html`, or a unique differently named HTML entry.
- Ordinary imports are non-editable, copy only validated displayable files, and re-importing the
  same private source-location hash updates the existing card.
- New imports privately retain their source path and lightweight accepted signature. Automatic
  checks expose `Atualizar da origem` on cards and imported-page screens when the source changes;
  applying the refresh remains explicit. On a published page, that explicit action becomes
  `Atualizar e publicar`; failed publication preserves the refreshed local copy and marks it as
  unpublished. Older imported cards must be re-imported once to establish this private link.
- Published pages persist whether local content differs from the confirmed public commit. Saving
  or refreshing marks `Alterações não publicadas`; only a confirmed publication clears it.
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
- `Trazer página` is the only page-entry action. It immediately opens folder selection; PageSpace
  has no built-in page creation or structural editor.
- Opening a page uses the consistent fixed header and a live sandboxed browser viewport.
  Ordinary/static pages use the full width; editable packages additionally expose only fields
  declared by their author in a fixed right-side panel.
- Page cards intentionally omit source-type labels to keep the dashboard visually quiet.
- App settings exposes one `Baixar instruções para IA (.txt)` action. It generates a handoff
  document from the currently installed PageSpace version and supported package contract.
- Existing GitHub Device Flow, protected storage, repository creation, retry, conflict detection,
  and Pages activation remain integrated.
- OAuth requests `public_repo` plus `delete_repo`. A published page offers the immediate
  `Excluir publicação` action beside its repository action; it deletes the remote repository while
  preserving the local page and resetting it to local-only.
- Publication metadata and GitHub authorization are independent: a page remains visibly online
  when authorization is absent, while update/delete controls stay unavailable with a prompt to
  link the persisted owner account.
- Initial publication derives a GitHub-safe repository name from the visible page-card name. Name
  collisions are resolved automatically with `-2`, `-3`, and so on; the chosen remote identity is
  permanent after creation even if the card is later renamed.
- User-facing failures use direct actionable language. Only technical failures append a short
  stable reference after `|`; implementation details remain in private diagnostics.
- Dashboard preview capture uses an exact 1280x720 browser content viewport and stores 960x540
  card images. Opening a page uses its actual generated website in a sandboxed browser viewport
  that fills the available workspace and responds to that real viewport size. The 64 px app header
  remains fixed during resizing. A 280 px right-side panel appears only when the imported package
  actually declares editable fields; ordinary/static pages use the full width.
- Application branding uses one dark-background PageSpace PNG for packaging and window surfaces.
- The opened-page header is fixed at 64 px and uses the shared
  `--pagespace-window-surface` color matching the current Windows title-bar surface. Ordinary and
  static pages use the full remaining live browser viewport; the package field panel appears only
  when editing capabilities are declared.
- `project/dist/localrelease/PageSpace/` is now the owner's persistent real-use test instance.
  `npm run refresh:localrelease` refreshes its binaries while preserving `Pages/`; use
  `export:localrelease` only when a deliberately empty first-run copy is requested.

## Validated Checkpoint

- Lint passes.
- Node and renderer TypeScript checks pass.
- Six test files and 54 tests pass.
- Production and unpacked portable builds pass.
- The review executable is `project/dist/PageSpace/PageSpace.exe`.
- Review builds preserve the existing persistent `Pages/` folder.
- Tests cover package validation, executable rejection, editable content, user assets, baking,
  ordinary entry discovery, source-change detection and refresh, saving, compatible updates,
  legacy simple-page compatibility and dynamic publication paths.

## Next Product Milestone

Complete the first real ordinary-site update lifecycle, then add declared package editing:

1. Change the external ordinary-site source and confirm detection, explicit refresh, managed-copy
   replacement, local live-view update, and update of the existing remote publication.
2. Convert the site into an editable package only after its visual template is settled.
3. Define stable title, section, and card fields/collections; keep instance values separate from
   template versions so compatible source updates preserve user-created content.
4. Verify save, bake, preview refresh, commit, push, source update, and value reconciliation as one
   complete lifecycle.
5. Continue synchronization edge-case hardening before colleague delivery.

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
