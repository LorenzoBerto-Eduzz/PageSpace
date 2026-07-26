# PageMaker Organization Direction

This note records the intended structure for PageMaker while the Electron application is scaffolded and grows.

## Core Rule

Keep files near the concept they belong to.

```text
Feature-specific files live with the feature.
Domain-specific files live with the domain concept.
Interface-specific files live with the interface.
Integration-specific files live with the integration.
Shared foundations live in shared/common folders.
```

The goal is to avoid huge folders full of unrelated files and to make deletion/replacement easy later.

## Repository Frame

The root of the repo is the project frame:

```text
PageMaker/
  project/
  asset_staging/
  local_assets/
  docs/
  notes/
  scripts/
```

The actual PageMaker application lives in `project/`. The rest of the folders help humans and AI collaborate safely.

`asset_staging/` is for raw/reference files that are okay to sync through Git. `local_assets/` is for private or machine-local files that should stay ignored unless the user explicitly asks AI to inspect them.

`scripts/` is for small, repeatable repository automation such as setup, validation, export, or delivery helpers. Add a script only after its inputs, outputs, and owner authorization are clear; document delivery scripts in `docs/DELIVERY_PROCESS.md`.

If `project/` is renamed during setup, update this document and every root-level doc that mentions the main project folder.

## Planned Application Structure

The Electron/Vite scaffold should be adapted toward this layout, following the selected toolchain's normal conventions:

```text
project/
  src/
    main/                 privileged Electron operations
      main.ts
      config-store.ts
      github-auth-service.ts
      git-service.ts
      site-project-service.ts
      public-output-service.ts
      filesystem-service.ts
    preload/              small, typed IPC bridge only
      preload.ts
    renderer/             PT-BR React/TypeScript interface (electron-vite)
      pages/              dashboard, editor, wizard, site/app settings
      components/         focused UI pieces such as SiteCard and PublishButton
      features/           site manager, editor, preview, publishing flows
      builder/            element contracts, validation, preview rendering
      styles/
  templates/
    links-hub-v1/         public static template, never Electron UI
      index.html
      styles.css
      app.js
      sample-data.json
```

Keep product behaviour grouped by the concept it serves. For example, the site editor's UI, validation, and transformations should remain discoverable together; Git execution must remain in main-process services rather than renderer components.

## Trust Boundaries

- **Renderer:** dashboard, forms, preview, validation messages, and status UI. It has no direct Node, filesystem, or shell access.
- **Preload:** exposes a narrow, typed, allowlisted PageMaker API to the renderer.
- **Main process:** owns dialogs, app config, protected credential access, filesystem work, public-file generation, Git/GitHub operations, and opening public URLs.
- **Public template:** runs in generated website repositories only. It reads public content and renders viewer-only pages; it has no PageMaker controls or local/private data.

## Data And Generated Output

- Local app configuration is machine-local, versioned JSON stored beneath Electron's `userData` path. A card's deployment state is explicit (`local-only` or `public-online`); local paths, remote URLs, public URLs, template names, and publish status may be recorded. It must not contain passwords or GitHub tokens.
- Per-website public content is stored in `data.json` for the MVP. Its canonical schema uses ordered pages/elements, with first-generation hero/text/section-card-grid element types.
- The public-output service creates a fresh generated folder from an explicit manifest. It receives only public `index.html`, `styles.css`, `app.js`, `data.json`, sanitized public `assets/`, and safe `.PageMaker.json` metadata.
- Do not mix PageMaker's own Electron project/repository into a managed website repository.

## Shared Foundations

Shared files are for foundations genuinely used by many features, domains, or interfaces.

Examples:

```text
project/
  src/
    shared/
      config/
      logging/
      errors/
      test_helpers/
```

Use shared folders only when the file really is shared. Do not put feature-specific files in a broad shared folder just because it is convenient at first.

## Current Project Status

The Electron + electron-vite + React + TypeScript application is scaffolded in `project/`. It currently keeps the selected toolchain's standard `main`, `preload`, and renderer source areas, plus small focused dashboard components and static presentation data. The renderer is intentionally non-privileged; the preload surface is empty until a specific local capability is implemented.

The planned structure above remains direction, not permission to create speculative abstractions. Add the first focused main-process services, typed IPC, feature folders, or templates only when the local card/config/editor workflow requires them.

Do not perform broad reorganizations casually. If a folder move will change many imports, paths, generated files, or user understanding, confirm first and do it as one focused structural change.
