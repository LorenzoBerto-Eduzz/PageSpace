# Delivery Process: PageMaker

PageMaker is intended to be distributed to end users as a Windows installer or portable executable. `electron-builder` is the selected packager, but its configuration, signing approach, artifact name, versioning process, and release workflow are not decided yet.

## Default Rule

Do not create PageMaker generated delivery artifacts, installers, portable executables, GitHub Releases, or deployments unless the owner explicitly asks and this document has been updated with a tested process.

This restriction concerns distribution of the PageMaker desktop app. Its future `Salvar e Postar` feature is a normal, per-website user workflow: it generates and Git-publishes the active managed website's clean static files. That feature still needs explicit implementation, validation, and user-visible confirmation.

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
