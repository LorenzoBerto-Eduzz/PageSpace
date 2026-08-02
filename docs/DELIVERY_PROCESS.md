# Delivery Process: PageSpace

PageSpace is distributed as a portable Windows folder, not an installer.

## Development Review Copy

```text
project/dist/PageSpace/
  PageSpace.exe
  Pages/
```

Create or refresh it with:

```text
cd project
npm run build:unpack
```

The script preserves the existing `Pages/` directory. During the rename transition it can also
carry forward an existing Pages directory from the former review-folder name.

Do not share the owner's development copy because `Pages/` may contain private packages, content,
local Git repositories, and publication metadata.

## Clean Local Release

The owner command `localrelease` means:

```text
project/dist/localrelease/PageSpace/
  PageSpace.exe
  Pages/                 empty
```

Create it only after owner authorization:

```text
cd project
npm run export:localrelease
```

The replaceable handoff artifacts use stable names:

```text
project/dist/localrelease/PageSpace/
project/dist/localrelease/PageSpace.zip
```

Do not append the application version to these local filenames. Record versions in application
metadata and, when explicitly authorized, GitHub Release metadata so a colleague can replace the
same folder/ZIP name predictably.

After the owner starts using that local release as a persistent real-world test instance, refresh
its application binaries without deleting its `Pages/` workspace with:

```text
cd project
npm run refresh:localrelease
```

`export:localrelease` always creates a fresh empty first-run copy. `refresh:localrelease` requires
an existing local release and preserves only its `Pages/` directory while replacing application
files from the newly built review copy. Close that local-release executable before refreshing it.

Required procedure:

1. Inspect the worktree and intended change.
2. Close running PageSpace review processes.
3. Run tests, lint, type checks, and the production build.
4. Refresh `project/dist/PageSpace/`.
5. Verify its persistent `Pages/` remains intact.
6. Create the clean local release with an empty `Pages/`.
7. Verify it contains no `.git`, `.pagespace`, legacy `.pagemaker`, `.git-identity`, `.env`,
   credentials, settings, packages, page content, logs, or local paths.
8. Smoke-test `PageSpace.exe`.

## Public Application Release

No GitHub Release, uploaded ZIP, installer, updater, or public PageSpace deployment is authorized
unless the owner explicitly requests it.

Compatible page projects are packaged independently. SotoDashboard currently uses the private
handoff paths `C:\C.Nvme\Projects\SotoDashboard\dist\localrelease\SotoDashboard\` and
`SotoDashboard.zip`. That clean package contains the browser-ready website and PageSpace contract,
but no PageSpace instance metadata, Git repository, credentials, user sections/cards, or private
assets. The colleague imports the whole `SotoDashboard` folder into PageSpace. Future template
updates replace the source handoff while PageSpace reconciles compatible private instance values.

The user-facing per-page `Publicar online` workflow is not an application release. It publishes
only the selected page's verified generated output.

## Rename Transition

- New review and clean-release folders use `PageSpace`.
- New executable name is `PageSpace.exe`.
- New Windows application ID is `com.pagespace.app`.
- The previous local test data and old app-data directory were intentionally cleared.
- The source GitHub repository is now `LorenzoBerto-Eduzz/PageSpace`, and `origin` uses that URL.
- The existing GitHub OAuth App display identity was renamed without replacing its Client ID.
- The outer active workspace folder may remain `PageMaker` indefinitely; this is cosmetic and does
  not affect delivered PageSpace artifacts. If renamed, first push a clean checkpoint, close Codex
  and PageSpace, rename externally, then reopen the new path as a new Codex workspace and recover
  project context from the repository documentation.
