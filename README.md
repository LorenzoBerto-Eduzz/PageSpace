# PageMaker

PageMaker is a Windows desktop application that lets non-technical people create and manage simple static websites in their own GitHub repositories and publish them to GitHub Pages without using a terminal, Git commands, or HTML.

It is the local authoring tool, not a public website. One PageMaker installation manages many website cards. A card starts local-only and receives a repository/public URL only after the user deliberately publishes it online.

## Layout

```text
PageMaker/
  project/               Electron application source
  asset_staging/         Git-safe raw/reference/transfer assets
  local_assets/          local-only ignored files
  docs/                  durable project, workflow, and AI memory
  notes/                 owner scratch and planning notes
  scripts/               optional repeatable repository automation
  .git-identity.example  copy into a project-specific .git-identity
  .githooks/             reusable email identity-guard hooks
  AGENTS.md              AI boot instructions
  README.md              repository overview
```

## Project Status

The product direction is agreed, the initial Git foundation is committed on `main`, and the Electron application now has its first static dashboard visual. The settled facts and next implementation priorities are in [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) and [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md).

The confirmed stack is Electron, `electron-vite`, React, and TypeScript. The first public template is `links-hub-v1`, with a versioned pages/elements content model serialized to `data.json` and generated static files suitable for GitHub Pages. PageMaker is desktop-first; a browser/localhost mode is a future option, not a replacement for the installed local backend.

## AI Workflow

`AGENTS.md` is the required AI-session boot file. The repository—not chat history—is the durable source of truth.

- `memcheck`: save distilled decisions, functionality, plans, constraints, commands, and pitfalls into durable docs only.
- `gitcheck`: perform `memcheck`, inspect and validate the intended work, verify Git identity, commit, and push unless the owner says not to.

AI should not commit, publish, package, export, release, deploy, or inspect local-only material unless explicitly asked.

## Local, Public, And Private Files

Use `asset_staging/` for Git-safe design references and raw assets. Use `local_assets/`, `local_data/`, or `private_data/` for private or machine-local material that must stay ignored.

PageMaker's local configuration may contain local paths and repository metadata, but must never store GitHub passwords or tokens. Generated website repositories and exported ZIPs must contain only clean public site files, intentionally placed/sanitized assets, and safe site metadata—never the Electron app, editor UI, app configuration, credentials, machine-local paths, drafts, or hidden internal data.

## Delivery

PageMaker is distributed as a portable Windows folder, not an installer. The owner's ongoing development copy is `project/dist/PageMaker/`; its executable is `PageMaker.exe` and persistent user pages live in `Pages/`.

When the owner requests `localrelease`, run `npm run export:localrelease` to create `project/dist/localrelease/PageMaker/`. That shareable folder deliberately mirrors the future downloadable GitHub Release layout and always contains an empty `Pages/`. Never share or upload the owner's populated development copy.
