# Project Brief: PageSpace

## Identity

- Product: `PageSpace`
- Form: portable Windows desktop application
- Source: `project/`
- Canonical repository path: `C:\C.Nvme\Projects\PageSpace`
- Stack: Electron + electron-vite + React + TypeScript
- Repository: `https://github.com/LorenzoBerto-Eduzz/PageSpace`.

## Purpose

PageSpace is a personal space for externally authored websites. It lets non-technical users import
them into managed local copies, keep them organized as cards, open exact local versions, edit only
author-declared content, bake safe static output, and explicitly publish individual pages through
their own GitHub account. It does not create or structurally edit websites itself.

AI is the primary flexible page-authoring surface. PageSpace provides the trusted package,
editing, storage, preview, baking, Git, GitHub, and publication lifecycle.

## Page Types

### Ordinary imported website

Any browser-ready static website with a clear HTML entry page. PageSpace detects root and common
output folders, a unique nested `index.html`, or a unique differently named HTML entry. It safely
copies only displayable static files, organizes the page, opens it locally, and publishes it. The
private source link is checked automatically; valid source changes automatically refresh the
managed copy while publication remains explicit. No automatic edit form is invented.

### Static PageSpace package

An already-baked AI-authored website. It can be imported, organized, viewed locally, replaced by a
newer compatible package, and published. It has no generated edit form.

### Editable PageSpace package

An AI-authored static website plus a versioned editable schema, default content, and optional
in-page editing extension. The package renders its own page-specific controls. PageSpace provides
only the generic edit/view bridge, validates changes, sanitizes replacement images, bakes the
public site, and preserves compatible user values during package updates.

## Main Workflow

1. The user selects `Trazer página` and chooses an externally authored website folder.
2. Ordinary websites and PageSpace packages are validated and copied atomically into `Pages/`.
3. Every page starts local-only.
4. PageSpace checks linked source content signatures on startup, focus, dashboard return, and page
   opening, then automatically validates and applies valid local source changes.
5. A failed or incomplete source update keeps the last verified managed copy. A refreshed
   published page is marked as having unpublished changes until the user explicitly publishes it.
6. The user may open the exact baked site in a normal browser.
7. Editable packages open in edit mode inside the same full-width page viewport. Their own
   extension renders author-defined controls; PageSpace only toggles edit/view and receives draft
   content through the sandboxed message bridge. The rejected fixed right-side panel must not be
   restored.
8. `Salvar` persists private values, keeps a backup, bakes output, and refreshes the preview. It
   never publishes implicitly. A published page then exposes `Publicar atualização` as a separate
   explicit action.
9. `Publicar online` confirms the page, account, automatically derived repository name, public URL,
   and exposure. Repository-name collisions receive a numeric suffix without user intervention.
10. PageSpace creates or safely updates only that page's repository and GitHub Pages site. Its
    remote identity remains stable after the first publication.
11. `Excluir publicação` immediately deletes the remote repository and returns the preserved local
    page to local-only.

Local save and source synchronization are not Git commits. They update the managed copy, bake
verified output when appropriate, and mark an existing publication as outdated. A Git commit and
push occur only during the user's explicit initial publication or publication update, and only
when the verified public output actually changed.

## Related Page Projects

PageSpace and imported page projects remain separate deliverables. This task may maintain both the
application and AI-authored compatible pages, but PageSpace never absorbs their visual or
page-specific editing logic. SotoDashboard is the first real use case: it is independently usable
in a browser and optionally exposes its own PageSpace editing extension. Its clean private handoff
starts without user sections/cards and is distributed directly rather than through the owner's
GitHub account.

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
Persistent test update: cd project; npm run refresh:localrelease
```

## Current Priorities

1. Validate an external visual source change through detection, refresh, local viewing, and update
   of its existing publication.
2. Add stable package-declared title, section, and card variables only after the page design is
   settled, preserving private instance values across compatible template versions.
3. Validate editable package content, images, baking, updates, and publication as one lifecycle.
4. Continue source synchronization and remote-conflict hardening before colleague delivery.

## Glossary

| Term | Meaning |
| --- | --- |
| PageSpace | Trusted local desktop application. |
| Page package | Portable AI-authored folder following the PageSpace contract. |
| Page instance | User's managed imported copy inside `Pages/`. |
| Static package | Ready website without a declared edit form. |
| Editable package | Website with declared fields and safe content baking. |
| Bake | Produce a fresh verified static website from current local content. |
| Local preview | Exact baked result opened locally without publishing. |
| Publish | Create or update the selected page's GitHub Pages destination. |
