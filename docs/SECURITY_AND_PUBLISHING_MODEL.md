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

Imported source locations and lightweight file metadata signatures remain private to the main
process. PageSpace may check them automatically, but it never replaces a managed copy merely from a
detected change. `Atualizar da origem` revalidates into staging before atomic replacement, and a
failed or unavailable source leaves the last managed copy intact.

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

- GitHub connection uses the existing OAuth App and Device Flow with `public_repo`.
- The public Client ID may ship; no client secret exists in the desktop app.
- Access tokens are encrypted with Electron `safeStorage` and Windows protection.
- Tokens remain in Electron main-process storage and never cross preload.
- Page packages never receive the account, token, or privileged GitHub API access.

## Publication

- Initial publication explicitly names the page, connected account, repository, URL, and public
  exposure.
- PageSpace creates a public repository only for the selected page.
- Repository-name collisions are rejected.
- A retry reuses persisted deployment state and never creates a duplicate repository.
- No-change updates create no empty commit.
- Before update, PageSpace verifies owner, visibility, archive state, write permission, and remote
  commit continuity.
- External remote changes stop publication instead of being overwritten.
- GitHub Pages uses `main` and `/docs`.

GitHub Pages is public. Authentication required by a destination link does not make the link
inventory itself private.

## Reliability

- Use schema validation, atomic writes, one validated backup, fresh generation, hash manifests,
  bounded network timeouts, single-flight publication, redacted diagnostics, and explicit recovery.
- Local deletion never implies remote repository deletion.
- Remote deletion remains a separate irreversible action.
