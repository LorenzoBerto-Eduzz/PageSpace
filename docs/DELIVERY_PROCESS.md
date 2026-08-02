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
localrelease/PageSpace/
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
localrelease/PageSpace/
localrelease/PageSpace.zip
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

No GitHub Release or uploaded application ZIP is authorized unless the owner explicitly requests
`remoterelease` (or otherwise explicitly requests a public release).

`remoterelease` means:

1. Perform `memcheck` and `gitcheck`, preserving owner scratch content and private data boundaries.
2. Select an appropriate semantic version bump unless the owner specifies the target version.
3. Update both `project/package.json` and its lockfile to that exact version.
4. Run tests, lint, type checks, production packaging, and `npm run export:localrelease`.
5. Verify `localrelease/PageSpace/pagespace-release.json` matches the version, `Pages/` is empty,
   and the folder/ZIP contain no private or forbidden data.
6. Commit and push the release checkpoint, create and push tag `v<version>`, then publish the exact
   stable-name `localrelease/PageSpace.zip` asset in this repository's GitHub Releases.
7. Verify GitHub reports the asset as uploaded with its size and `sha256:` digest and that the
   unauthenticated latest-release endpoint returns the new stable release.

The built-in updater checks only
`https://api.github.com/repos/LorenzoBerto-Eduzz/PageSpace/releases/latest`. It accepts only a
non-draft, non-prerelease semantic tag newer than the installed app, the exact asset name
`PageSpace.zip`, the official repository download URL, and GitHub's SHA-256 asset digest. It
downloads into a private staging directory beside the installation, verifies the digest and
embedded `pagespace-release.json`, validates the extracted tree, closes PageSpace, swaps the
portable application folder through a detached Windows helper, preserves the existing `Pages/`,
restarts PageSpace, and rolls back if replacement fails. GitHub authorization remains in the
protected Windows profile and is not part of the swapped folder.

The first updater-capable PageSpace build must still be delivered manually. Once installed, later
`remoterelease` versions can be installed from Settings with `Baixar e atualizar`.

Compatible page projects are packaged independently. SotoDashboard uses the canonical project
path `C:\C.Nvme\Projects\Pages\SotoDashboard` and private handoff paths
`localrelease\SotoDashboard\` and `localrelease\SotoDashboard.zip`. That clean package contains
the browser-ready website and PageSpace contract,
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
- The canonical repository path is `C:\C.Nvme\Projects\PageSpace`. The previous `PageMaker`
  workspace was removed after the canonical copy was verified.
