# Project Brief: PageMaker

## Identity

- Project name: `PageMaker`
- Project kind: `Windows desktop website manager and static-site page builder`
- Main project folder: `project/`
- Primary language/stack: `Electron + electron-vite + React + TypeScript`

## Purpose

PageMaker is a locally installed Windows app that lets non-technical users create, configure, edit, preview, generate, export, and explicitly publish simple static websites. It hides local-file, Git, repository, commit, push, and deployment mechanics behind a visual interface.

PageMaker is the private local tool. Each managed website is a separate website instance/card. Cards start local-only; a GitHub Pages site exists only after the user deliberately chooses to publish that card online. Every generated public site is clean, static, and viewer-only.

## Audience Or Users

People who need to maintain small links hubs, portfolios, document portals, or resource pages but should not need to understand code, terminals, Git, GitHub Pages, commits, or pushes.

## Current Scope

Build a colleague-usable desktop MVP with a PT-BR multi-site dashboard, reliable local folders/cards, foundational title-element editing and layout controls, sanitized public-output generation, global GitHub account connection, and an explicit per-site `Publicar online` flow. That flow creates/configures only the selected card's public repository and GitHub Pages deployment, then publishes it with friendly status/error feedback. Additional element families and ZIP export/import are later-version work.

## Run And Test Commands

```text
Run: cd project; npm run dev
Lint: cd project; npm run lint
Type check: cd project; npm run typecheck
Build: cd project; npm run build
Local review build: cd project; npm run build:unpack
Clean shareable localrelease: cd project; npm run export:localrelease
```

If commands are not known yet, write `unknown` and ask before assuming.

## Delivery Or Release Process

- Delivery command/policy: `build:unpack refreshes the owner's project/dist/PageMaker/ development copy and preserves its Pages/. localrelease runs export:localrelease and creates project/dist/localrelease/PageMaker/ with an empty Pages/ and no local user/developer data.`
- Versioning/release authority: `Owner approval required for versions, artifacts, and releases.`

Keep this brief summary current. Put detailed build, export, package, deployment, or publish instructions in `docs/DELIVERY_PROCESS.md` only after the project has a real process.

## Important Constraints

- Primary platform is Windows; distribution target is a portable `PageMaker/` folder, not an installer. Users may place the folder wherever they choose and run `PageMaker.exe` directly.
- Every page lives in `PageMaker/Pages/<creation-name>/`. Normal PT-BR accents and spaces are preserved in the folder name; only Windows-forbidden characters are made safe. A later dashboard rename changes the card label only and leaves the stable folder/local Git repository unchanged.
- Use `electron-vite` with React and TypeScript. Do not substitute a framework without owner approval.
- Use versioned JSON in Electron's `userData` folder for machine-local app configuration. Do not introduce a database or cloud sync in the MVP.
- Treat PageMaker as business-grade software: use schema validation, atomic writes, recoverable backups, idempotent operations, redacted diagnostic logs, publish history, and focused automated tests around generation and publishing.
- The canonical content model is ordered pages/elements. The first UI may expose only hero/text/section-card-grid controls.
- The renderer must never directly execute shell commands. Privileged filesystem, Git, dialogs, and external-URL actions belong in Electron's main process and must be exposed through a narrow preload IPC API.
- New cards are local-only by default. They have no remote, public URL, or external exposure until the user deliberately completes `Publicar online`.
- The global GitHub connection must use a secure browser-based authorization flow. Credentials/tokens belong only in protected OS storage, never JSON configuration, logs, public files, remote URLs, or ZIP exports.
- `Publicar online` creates/configures the selected card's repository and GitHub Pages deployment. Importing an existing repository is a secondary advanced flow.
- UI language is Brazilian Portuguese. The product should feel visual, friendly, and safe for non-technical users.
- Public/ZIP output is static and generated from a strict allowlist/manifest. It must never include the dashboard, editor, app settings, Git logs, credentials, local paths, drafts, app metadata, or other private controls/data.
- Only content and assets the user intentionally places on that website may appear in generated output. Sanitize images to remove EXIF/GPS and similar embedded metadata by default.
- Publish only the selected website instance; do not publish every dashboard site.
- Do not turn a local-only card public through a one-click toggle. Use a confirmation flow that identifies the card, destination account/repository, public URL, and content being exposed.
- Electron is the primary release form. A future browser UI still requires the installed local PageMaker service and must bind only to loopback with local-session protections.
- Do not automatically resolve Git conflicts in the MVP. Stop with a friendly error and a technical-details view.
- Validate required titles and `http://`/`https://` card URLs before publishing.

## Current Priorities

1. Implement and test a sanitized static generator for the existing title/layout content model with strict public-output allowlisting.
2. Implement global GitHub authorization through dashboard settings with protected credential storage.
3. Add per-page publishing settings and the explicit online-publish confirmation flow.
4. Create/configure the selected public GitHub repository and Pages deployment, then publish only generated output for that card.
5. Validate the clean portable colleague handoff and publishing failure/recovery paths.
6. Add richer elements, ZIP export/import, and existing-repository import in later versions.

## Current Visual Foundation

- The PT-BR dashboard shows `Minhas Páginas`, global settings, stored website cards, and a square create-page control.
- The installed review build starts maximized with a light native Windows frame. Its dashboard canvas uses a restrained smoky blue/gold light background and soft dark-gray text.
- Cards and controls use the same soft-gray contour and corner radius. The full card is the visual editor entry target, with compact local/private and settings icon actions at its lower right.
- Full-screen layout is designed for four card columns and two rows. When later card data creates overflow, only the dashboard field scrolls, using a thin light-gray scrollbar aligned beneath the global settings control.
- Page creation, persistent listing, clean private previews, and opening/editing/saving a card are functional.
- The page editor currently supports ordinary ordered single-line title elements, direct editing, add/delete/reorder, independent side margins, positional vertical gaps, and unsaved-change protection.
- Page settings, sanitized generated output, GitHub connection, export, and publishing are not implemented yet.

## Glossary

| Term | Meaning |
| --- | --- |
| PageMaker app | The installed local Electron application. |
| Website instance / card | One managed website configuration inside PageMaker. |
| Local-only card | A website that remains on the user's computer, with no remote repository or public address. |
| Public site | The generated static website hosted through GitHub Pages. |
| Publicar online | Deliberate confirmation flow that creates/configures the selected site's online destination and publishes it. |
| Sanitized export | Static public-safe files/ZIP generated from the same strict allowlist used for online publishing. |
| Bake / generate | Transform editable local content into clean public website files. |
| `links-hub-v1` | The first public template: a responsive hub of sections and link cards. |
| Salvar | Save local editable content only. |
| Salvar e Postar | Save, generate public output, commit, and push the current website. |

## Known Pitfalls

- Do not confuse PageMaker source with generated website repositories. They are separate folders with separate purposes.
- Local-only does not mean password-protected on the internet; it means not deployed. Future authenticated/private online sites are a separate capability.
- Never publish a workspace folder directly. Publish only a fresh generated output folder verified against its manifest.
- Do not include image metadata, hidden files, local drafts, machine paths, or internal configuration in public/ZIP output.
- Before refreshing the development build or creating `localrelease`, close any running PageMaker review executable; Windows can lock files in `project/dist/PageMaker/`. The development build replaces only generated runtime files and preserves `Pages/`; the separate localrelease is recreated clean with an empty `Pages/`.
- A successful Git push does not mean GitHub Pages is instantly live; show the public link after push, but allow GitHub's publishing delay.
- A no-change publish must not create an empty commit; communicate `Nenhuma alteração para publicar`.
- `git pull --rebase` may be useful before publishing, but conflicts require user resolution outside automatic MVP handling.
- Keep implementation modular around ordered page elements even if the initial editor UI exposes only structured sections/cards. Do not start with a free-moving canvas.
- The PageMaker repository is initialized locally on `main` with its email identity guard enabled. No remote is configured yet; do not add or push to one without owner authorization.
