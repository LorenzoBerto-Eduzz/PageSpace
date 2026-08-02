# AI Handoff: PageSpace

## Canonical Migration Checkpoint

- The verified canonical repository is now `C:\C.Nvme\Projects\PageSpace` with the original Git
  history, `main` branch, local identity guard, and
  `https://github.com/LorenzoBerto-Eduzz/PageSpace.git` origin intact.
- The former `C:\C.Nvme\Projects\PageMaker` workspace and former standalone SotoDashboard folder
  were removed after the canonical projects were verified. Do not recreate or resume work from
  those obsolete paths.
- Generated dependencies were reinstalled in the canonical project. `npm install` reported one
  upstream high-severity audit item; no unreviewed automatic dependency rewrite was applied.
- The migration-path, ignore-rule, release-automation, and durable-documentation changes belong to
  the final canonical migration checkpoint. Owner scratch content under `notes/` remains untracked
  and must not be committed unless explicitly requested.
- PageSpace validation at migration passed 57 tests, lint, Node/web type checks, production build,
  Windows portable packaging, and clean-release validation.
- Clean artifacts are `C:\C.Nvme\Projects\PageSpace\localrelease\PageSpace\` and
  `PageSpace.zip`. Their `Pages/` folder is empty and no private metadata is included.
- The Windows PageSpace profile, prior linked-GitHub authorization, authorization backup, test
  page instances, and test caches were explicitly removed for a genuine first-user test. Do not
  launch PageSpace before the owner is ready to begin that test, because launch recreates the
  Windows profile.
- SotoDashboard moved to `C:\C.Nvme\Projects\Pages\SotoDashboard`; its own `AGENTS.md` and
  `docs/AI_HANDOFF.md` are authoritative for that separate page project.

## Current State

- The product has pivoted from PageMaker to `PageSpace`.
- The application, package metadata, executable, Windows app ID, UI, GitHub user agents, build
  folders, source repository, and OAuth App display identity now use PageSpace.
- The GitHub source repository is
  `https://github.com/LorenzoBerto-Eduzz/PageSpace`; local `origin` tracks it.
- The existing OAuth Client ID and Device Flow implementation were intentionally preserved.
- The previous local test pages, legacy application data, and both disposable GitHub test
  repositories were removed.
- Source remains in `project/`. The canonical local repository path is
  `C:\C.Nvme\Projects\PageSpace`.
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
- New imports privately retain their source path and accepted content signature. Startup, focus,
  dashboard return, and page opening automatically detect, validate, stage, and atomically apply a
  valid source change to the managed copy. Invalid/incomplete sources retain the last verified
  copy. Automatic synchronization never publishes; an already-published page is marked as having
  unpublished changes until the user explicitly publishes it. Older imported cards must be
  re-imported once to establish this private link.
- Published pages persist whether local content differs from the confirmed public commit. Saving
  or refreshing marks `Alterações não publicadas`; only a confirmed publication clears it.
- Editable fields support text, textarea, URL, color, image, boolean, select, and repeatable
  collections. Collections may contain one nested collection, supporting generic structures such
  as sections with cards without adding page-specific editor logic to PageSpace.
- Editable websites read generated values through `window.PAGESPACE_CONTENT`.
- Imported packages never run privileged or arbitrary build commands.
- Package installation and updates use staging, atomic replacement, and stable package IDs.
- Compatible editable values survive updates by stable field key, type, nesting, and stable item
  identity. Seed values from `content.json` and the owner's private working values remain separate.
- User-selected images are decoded through Electron and re-encoded as PNG before storage.
- Baking copies validated static files, generates `pagespace-content.js`, includes approved user
  assets, hashes every output file, and atomically replaces prior output.
- Publication accepts the exact dynamic allowlist produced by the current verified generation.
- `Trazer página` is the only page-entry action. It immediately opens folder selection; PageSpace
  has no built-in page creation or structural editor.
- Opening a page uses the consistent fixed header and a full-width live sandboxed browser
  viewport. Editable packages start in edit mode. PageSpace sends generic edit/view state and
  current content through `postMessage`; the package owns every page-specific visual control and
  returns full draft content. Do not restore the rejected fixed right-side panel or hardcode
  sections/cards in PageSpace.
- `Salvar` validates private draft values, backs up the prior state, bakes local output, refreshes
  the preview, and marks a published page as changed. `Publicar atualização` separately updates its
  existing remote publication.
- The generic in-page bridge also supports narrow image requests from the Windows clipboard or
  native file picker. PageSpace safely re-encodes and privately stores the image, returning a
  relative content value plus temporary preview data. Sandboxed HTTP(S) card links use a separate
  validated open-link request. Packages receive no general clipboard, filesystem, or shell access.
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
- Dashboard preview capture uses the current PageSpace page-view viewport below its fixed 64 px
  header and stores a 1104 px-wide image at that same aspect ratio. Automatic offscreen capture
  waits for the embedded page frame and its deferred scripts to finish before capture. Cards
  preserve the complete image without cropping. Merely opening or closing page view is read-only
  and never replaces the stored dashboard preview; only import, validated source refresh, recovery,
  or saved content changes may regenerate it.
  Opening a page uses its actual generated website in a sandboxed browser viewport
  that fills the available workspace and responds to that real viewport size. The 64 px app header
  remains fixed during resizing, and the page currently uses the full width for every page type.
- Application branding uses one dark-background PageSpace PNG for packaging and window surfaces.
  Its reusable background-color token is `iconBgColor: rgb(23, 0, 64)`, stored in
  `project/resources/brand.json` and mirrored as `--pagespace-icon-bg-color` in renderer CSS.
  `project/resources/icon.png` is the master artwork; Windows packaging and BrowserWindow use the
  multi-resolution `project/resources/icon.ico` so title-bar and taskbar sizes remain crisp. The
  corresponding `project/build/icon.png` and `project/build/icon.ico` copies are the packaging
  resources and must remain byte-identical to their canonical counterparts.
- The opened-page header is fixed at 64 px and uses the shared
  `--pagespace-window-surface` color matching the current Windows title-bar surface. Ordinary and
  static pages use the full remaining live browser viewport; the package field panel appears only
  when editing capabilities are declared.
- `localrelease/PageSpace/` is the owner's persistent real-use test instance.
  `npm run refresh:localrelease` refreshes its binaries while preserving `Pages/`; use
  `export:localrelease` only when a deliberately empty first-run copy is requested.
- PageSpace and compatible page projects are separate deliverables maintained from this AI task.
  The clean PageSpace handoff uses `localrelease/PageSpace/` and `localrelease/PageSpace.zip`;
  version numbers
  belong in internal metadata and GitHub Release metadata, not the replaceable artifact name.
- SotoDashboard is the first real compatible page project at
  `C:\C.Nvme\Projects\Pages\SotoDashboard`. It remains independently browser-ready, while its optional
  PageSpace extension owns title, section, card, link, and image editing. Its private handoff uses
  `localrelease/SotoDashboard/` and `localrelease/SotoDashboard.zip`, with clean seed content and no user
  instance data. It currently has no Git repository and is shared directly with the colleague.
- Saving editable content and automatic source refresh update/bake the managed local page but do
  not create Git commits. If the page is published they mark it as having unpublished changes.
  Explicit initial publication or `Publicar atualização` stages only verified public output,
  creates a Git commit when output changed, and pushes it.

## Validated Checkpoint

- Lint passes.
- Node and renderer TypeScript checks pass.
- Six test files and 57 tests pass.
- Production and unpacked portable builds pass.
- The review executable is `project/dist/PageSpace/PageSpace.exe`.
- Review builds preserve the existing persistent `Pages/` folder.
- Tests cover package validation, executable rejection, editable content, user assets, baking,
  ordinary entry discovery, source-change detection and refresh, saving, compatible updates,
  legacy simple-page compatibility and dynamic publication paths.

## Next Product Milestone

Verify the first real editable-package lifecycle with SotoDashboard:

1. Verify SotoDashboard v1.3 edit mode: hover-only remove control, add-card at each section end,
   centered card modal, title/description/address editing, clipboard/file images, edit/view toggle,
   and unsaved-change protection.
2. Save locally and confirm the baked browser view and dashboard preview reflect the values.
3. Publish, make another edit, save, and explicitly publish the update to the same repository.
4. Increment the external SotoDashboard package version and change its template while preserving
   stable schema keys; confirm PageSpace keeps the owner's private values during source refresh.
5. Continue synchronization and editor edge-case hardening before colleague delivery.

Clean zero-content local releases were generated for practical first-user testing. The owner will
test the portable PageSpace build by importing the clean SotoDashboard handoff, linking GitHub,
editing, saving, publishing, and updating it, then report product and visual refinements here.

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
