# Project Brief: PageSpace

## Identity

- Product: `PageSpace`
- Form: portable Windows desktop application
- Source: `project/`
- Stack: Electron + electron-vite + React + TypeScript
- Repository: `https://github.com/LorenzoBerto-Eduzz/PageSpace`; the local root folder retains its
  previous directory name until a clean workspace checkpoint.

## Purpose

PageSpace is a personal space for websites. It lets non-technical users create basic pages or
import visually unrestricted websites created by AI, keep them organized as cards, open exact
local versions, edit only author-declared content, bake safe static output, and explicitly publish
individual pages through their own GitHub account.

AI is the primary flexible page-authoring surface. PageSpace provides the trusted package,
editing, storage, preview, baking, Git, GitHub, and publication lifecycle.

## Page Types

### Simple page

Created inside PageSpace with the built-in editor. The current simple model supports ordered title
elements and layout spacing.

### Static PageSpace package

An already-baked AI-authored website. It can be imported, organized, viewed locally, replaced by a
newer compatible package, and published. It has no generated edit form.

### Editable PageSpace package

An AI-authored static website plus a versioned editable schema and default content. PageSpace
generates the edit form, validates changes, sanitizes replacement images, bakes the public site,
and preserves compatible user values during package updates.

## Main Workflow

1. The user selects the left `Trazer página` tile or the right `Criar página` tile.
2. Imported packages are validated and copied atomically into `Pages/`.
3. Every page starts local-only.
4. The user may open the exact baked site in a normal browser.
5. Editable packages expose only declared fields and collections.
6. `Salvar` persists private values, keeps a backup, bakes output, and refreshes the preview.
7. `Publicar online` confirms the page, account, repository, public URL, and exposure.
8. PageSpace creates or safely updates only that page's repository and GitHub Pages site.

## Package Contract

The supported package format is versioned independently from the app. PageSpace exposes one
button that downloads a TXT containing the AI-authoring instructions supported by the installed
application version. Those instructions define integration and security requirements without
constraining visual design.

See `docs/PAGESPACE_PACKAGE_FORMAT.md`.

## Important Constraints

- Imported packages never execute shell commands, npm, PowerShell, Python, executables, symlinks,
  or privileged build logic.
- Package `site/` output must already be browser-ready static content.
- Editable packages consume validated values through the generated `pagespace-content.js`
  contract.
- The renderer never receives filesystem, Git, GitHub token, or shell capabilities.
- Images selected through PageSpace are decoded and re-encoded before public output.
- Package identity and stable field keys preserve compatible user content across design updates.
- Public output is generated from scratch, hashed, and allowlisted before publication.
- GitHub Pages is public. Link inventories and public assets must be treated as public content.
- Remote conflicts stop publication; PageSpace never silently overwrites external changes.

## Commands

```text
Run: cd project; npm run dev
Test: cd project; npm test
Lint: cd project; npm run lint
Type check: cd project; npm run typecheck
Build: cd project; npm run build
Review build: cd project; npm run build:unpack
Clean handoff: cd project; npm run export:localrelease
```

## Current Priorities

1. Validate static and editable package import with disposable sample packages.
2. Validate local preview, editable content, images, package updates, and dynamic publication
   allowlisting as one complete vertical slice.
3. Validate disposable GitHub publication, update, retry, and conflict behavior.
4. Refine the `Trazer página` and `Criar página` workflows from those findings.
5. Use SotoDashboard as the first colleague-facing package after the platform is stable.

## Glossary

| Term | Meaning |
| --- | --- |
| PageSpace | Trusted local desktop application. |
| Page package | Portable AI-authored folder following the PageSpace contract. |
| Page instance | User's managed imported copy inside `Pages/`. |
| Simple page | Page created with PageSpace's built-in editor. |
| Static package | Ready website without a declared edit form. |
| Editable package | Website with declared fields and safe content baking. |
| Bake | Produce a fresh verified static website from current local content. |
| Local preview | Exact baked result opened locally without publishing. |
| Publish | Create or update the selected page's GitHub Pages destination. |
