# Delivery Process: PageMaker

PageMaker is intended to be distributed as a portable Windows `PageMaker/` folder, not an installer. `electron-builder` creates the runtime and the project build script places it beside the persistent `Pages/` workspace.

## Default Rule

Do not create PageMaker generated delivery artifacts, installers, portable executables, GitHub Releases, or deployments unless the owner explicitly asks and this document has been updated with a tested process.

This restriction concerns distribution of the PageMaker desktop app. Its future `Salvar e Postar` feature is a normal, per-website user workflow: it generates and Git-publishes the active managed website's clean static files. That feature still needs explicit implementation, validation, and user-visible confirmation.

## Owner Development Review Build

The owner runs and pins this copy during active development.

- Purpose: the owner's current visual/functionality review copy.
- Packager: `electron-builder` through `npm run build:unpack` in `project/`.
- Expected output: `project/dist/PageMaker/`.
- Windows entry point: `project/dist/PageMaker/PageMaker.exe`.
- Sharing rule: do not share this folder because its persistent `Pages/` may contain the owner's local pages and Git metadata. Use `localrelease` for colleague handoff.
- Validation: run lint, type checks, a production build, then open `PageMaker.exe` from the unpacked folder.
- Security: inspect the output folder before sharing; it must not contain `.env` files, `.git-identity`, app-local data, user content, credentials, exports, or development sources.
- Signing: this review build is unsigned, so Windows may show a SmartScreen warning. Do not present it as a signed or production-ready installer.

The generated `dist/` output is ignored by Git. Do not commit, push, or publish this review build unless the owner explicitly asks.

## Clean localrelease Workflow

`localrelease` means a clean, shareable portable folder for a colleague and is also the intended shape of a future GitHub Release:

```text
project/dist/localrelease/PageMaker/
```

Create it with:

```text
cd project
npm run export:localrelease
```

Procedure:

1. Inspect the worktree and confirm the completed change is in scope.
2. Close every running PageMaker review window/process so Windows does not lock output files.
3. Run `npm run lint`, `npm run typecheck`, and `npm run export:localrelease` from `project/`.
4. Verify the owner's `project/dist/PageMaker/Pages/` remains unchanged.
5. Verify `project/dist/localrelease/PageMaker/` contains `PageMaker.exe`, an empty `Pages/`, and no `.git`, `.pagemaker`, `.git-identity`, `.env`, credentials, settings, page content, logs, or local paths.
6. Launch the clean executable once as a smoke test, then report the shareable folder path.

`localrelease` refreshes the owner's development runtime while preserving its data, then recreates the separate clean handoff folder. It does not create a commit, push a remote, upload an artifact, or imply that the build is signed/production-ready.

## Future Public Portable Release

The future downloadable artifact will be a ZIP containing one portable `PageMaker/` folder with the same layout used by local review:

```text
PageMaker/
  PageMaker.exe
  Pages/
  resources and runtime files
```

The public artifact must be assembled through the same clean-export boundary as `localrelease`, with an empty `Pages/` folder. Never ZIP or upload the developer's populated `project/dist/PageMaker/` folder. The release process must still repeat all privacy checks before upload.

## When A Project Needs Delivery

Before establishing a named command such as `localrelease`, document:

- the Electron packager and its configuration;
- source inputs, generated output location, installer/portable artifact naming, and ignored paths;
- prerequisite checks, app smoke tests, and packaging validation;
- versioning rules and owner release authority;
- Windows code-signing, publishing, and approval requirements, if any;
- how to test the installed artifact and recover from a failed release.

Keep the process small, repeatable, and specific to the project. Add a repository script only when it reliably performs that documented workflow.

## Before Any Delivery

1. Inspect the intended source changes and Git state.
2. Run relevant validation for the project.
3. Confirm the requested target, version, and scope.
4. Confirm no private data, credentials, or unintended generated files will be included.
5. Report exactly what was created, uploaded, or deployed.
