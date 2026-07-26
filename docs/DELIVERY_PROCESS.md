# Delivery Process: PageMaker

PageMaker is intended to be distributed to end users as a Windows installer or portable executable. `electron-builder` is the selected packager, but its configuration, signing approach, artifact name, versioning process, and release workflow are not decided yet.

## Default Rule

Do not create PageMaker generated delivery artifacts, installers, portable executables, GitHub Releases, or deployments unless the owner explicitly asks and this document has been updated with a tested process.

This restriction concerns distribution of the PageMaker desktop app. Its future `Salvar e Postar` feature is a normal, per-website user workflow: it generates and Git-publishes the active managed website's clean static files. That feature still needs explicit implementation, validation, and user-visible confirmation.

## Approved Local Review Build

The owner may request a local review build so a trusted colleague can evaluate the current desktop interface before an installer, signing, or public release exists.

- Purpose: visual/functionality review only; it is not a supported public release.
- Packager: `electron-builder` through `npm run build:unpack` in `project/`.
- Expected output: `project/dist/win-unpacked/`.
- Windows entry point: `project/dist/win-unpacked/PageMaker.exe`.
- Sharing rule: copy/share the entire `win-unpacked` folder, not only the executable; Electron needs the adjacent runtime files.
- Validation: run lint, type checks, a production build, then open `PageMaker.exe` from the unpacked folder.
- Security: inspect the output folder before sharing; it must not contain `.env` files, `.git-identity`, app-local data, user content, credentials, exports, or development sources.
- Signing: this review build is unsigned, so Windows may show a SmartScreen warning. Do not present it as a signed or production-ready installer.

The generated `dist/` output is ignored by Git. Do not commit, push, or publish this review build unless the owner explicitly asks.

## localrelease Workflow

`localrelease` is the project command for a repeatable local review build. After each completed user-visible app change or implementation milestone, refresh this same folder unless the owner says not to:

```text
project/dist/win-unpacked/
```

The owner can bookmark or create a shortcut to this stable executable:

```text
project/dist/win-unpacked/PageMaker.exe
```

Do not rebuild after every intermediate edit in a multi-step task. Rebuild when that task is complete and ready for the owner's visual/functional review.

Procedure:

1. Inspect the worktree and confirm the completed change is in scope.
2. Close every running PageMaker review window/process so Windows does not lock output files.
3. Run `npm run lint`, `npm run typecheck`, and `npm run build:unpack` from `project/`.
4. Verify the refreshed `win-unpacked` folder contains `PageMaker.exe` and no private/configuration files.
5. Launch `PageMaker.exe` once as a smoke test, then report the stable folder path.

`localrelease` overwrites the prior local review build in place. It does not create a commit, push a remote, upload an artifact, or imply that the build is signed/production-ready.

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
