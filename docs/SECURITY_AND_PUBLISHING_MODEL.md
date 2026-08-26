# PageSpace Security And Publishing Model

## Default State

Every simple or imported page begins local-only. Importing, editing, baking, or opening a local page
does not create a repository or network publication.

## Trust Model

PageSpace is trusted local software. Imported page packages are untrusted.

Imported ordinary websites and packages may contribute browser-ready HTML, CSS, JavaScript, fonts,
images, media, and supported static assets. PageSpace copies only the validated displayable subset
and ignores ordinary project controls such as hidden Git data, `node_modules`, and unsupported
source files. Imports may not contain or trigger:

- executables;
- package-provided PowerShell, Python, shell, or npm build commands;
- symbolic links;
- path traversal;
- hidden control files;
- credentials or tokens;
- Node, Electron, preload, filesystem, Git, or GitHub capabilities.

Package browser code is previewed with context isolation, Node disabled, sandboxing, and no preload
bridge.

Imported source locations and accepted content signatures remain private to the main process.
PageSpace checks them automatically on startup, focus, dashboard return, and page opening. A
changed source is fully revalidated in staging before its managed copy is atomically replaced. A
failed, incomplete, or unavailable source leaves the last verified managed copy intact.

## Static And Editable Packages

- Ordinary imported website: browser-ready static files without a PageSpace edit contract.
- Static package: validated site output only; no generated editor.
- Editable package: validated site plus declarative schema/default content.
- PageSpace generates forms from the schema and validates every saved value.
- Page JavaScript reads only public values generated into `pagespace-content.js`.
- User-selected images are decoded and re-encoded before becoming package user assets.
- Stable package IDs and schema keys are required for safe compatible updates.

## One-Way Public Boundary

1. Read validated simple content or installed package/content.
2. Create a new temporary generated-output directory.
3. Copy only validated package site files.
4. Generate public editable values and sanitized user assets when applicable.
5. Hash every output file and write a private manifest.
6. Verify the exact paths, sizes, and hashes.
7. Atomically replace the previous generated output.
8. Copy only that output into the managed `docs/` publication tree.
9. Stage only `.gitignore`, the current dynamic `docs/` allowlist, and deletions of obsolete managed
   `docs/` files.

Never publish:

- `.pagespace/`;
- editable `content.json`;
- package manifests or schemas unless intentionally part of the public site;
- previews or backups;
- application source or UI;
- local paths;
- Git state;
- credentials, authorization state, or account details;
- unrelated assets.

## Credentials

- GitHub connection uses the existing OAuth App and Device Flow with `public_repo` and
  `delete_repo`. The latter is used only from the explicit `Excluir publicação` action for the
  repository persistently associated with that page.
- The public Client ID may ship; no client secret exists in the desktop app.
- Access tokens are encrypted with Electron `safeStorage` and Windows protection.
- Stored authorization is versioned with its granted scopes; older or insufficient authorization
  is treated as disconnected and must be linked again rather than failing later during deletion.
- Tokens remain in Electron main-process storage and never cross preload.
- Page packages never receive the account, token, or privileged GitHub API access.

## Application Updates

- Update checks are unauthenticated and restricted to the official PageSpace repository's latest
  stable GitHub Release.
- Only the exact `PageSpace.zip` asset is accepted, and only when GitHub provides its SHA-256
  digest. The downloaded bytes must match both the published size and digest.
- Extracted updates must contain the matching `pagespace-release.json`, `PageSpace.exe`, an empty
  `Pages/`, no symbolic links, and remain inside bounded file-count and size limits.
- The update is staged before the running process exits. A detached trusted Windows helper swaps
  the folder, transfers the old private `Pages/` into the new installation, restarts the app, and
  restores the old installation if replacement fails.
- Package-provided code has no access to update checks, downloads, staging, or replacement.

## Publication

- Initial publication explicitly names the page, connected account, repository, URL, and public
  exposure.
- PageSpace creates a public repository only for the selected page.
- PageSpace derives the initial repository name from the visible page name and resolves collisions
  with a numeric suffix. The confirmed repository identity is then persisted permanently.
- A retry reuses persisted deployment state and never creates a duplicate repository.
- No-change updates create no empty commit.
- Before update, PageSpace verifies owner, visibility, archive state, write permission, and remote
  commit continuity.
- External remote changes stop publication instead of being overwritten.
- Saving or refreshing an already-published page marks its local state as unpublished. Only a
  confirmed push clears that state; failures preserve local work for an explicit retry.
- Automatic source synchronization never performs a network write. Publishing refreshed content
  remains a separate explicit user action.
- GitHub Pages uses `main` and `/docs`.

GitHub Pages is public. Authentication required by a destination link does not make the link
inventory itself private.

## Reliability

- Use schema validation, atomic writes, one validated backup, fresh generation, hash manifests,
  bounded network timeouts, single-flight publication, redacted diagnostics, and explicit recovery.
- Treat GitHub rate limiting and server-side failures as temporary, retryable publication errors.
  Preserve the local/generated state and resumable deployment metadata, and never expose raw
  provider deployment messages or request details in the renderer.
- Local page deletion never implies remote repository deletion.
- `Excluir publicação` is a separate one-click irreversible action. It deletes only the persisted
  repository through GitHub, preserves the local page, removes its local `origin`, and returns its
  deployment state to local-only only after GitHub confirms deletion or confirms the repository is
  already absent.

## User-Facing Errors

- Expected user-correctable failures state what happened and the next action in plain language.
- Internal framework, IPC, stack, filesystem, Git command, and implementation text is never shown.
- Technical failures may append a stable short reference after `|`, such as `PUB-PUSH-01`, while
  detailed redacted diagnostics remain private for developer or AI troubleshooting.
