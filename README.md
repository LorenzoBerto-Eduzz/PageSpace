# PageSpace

PageSpace is a portable Windows desktop application for organizing, locally viewing, selectively
editing, baking, and explicitly publishing static websites.

It supports two complementary creation paths:

- Create a simple page with the built-in editor.
- Bring any browser-ready static website for organization, local viewing, and publishing.
- Bring an AI-authored PageSpace package whose optional editable fields are declared by its author.

Every website begins local-only. Connecting GitHub is global to the local application; publishing
is an explicit per-page operation that creates or updates only that page's public repository and
GitHub Pages site.

## Source

The Electron + electron-vite + React + TypeScript application lives in `project/`.

```text
Run:             cd project; npm run dev
Test:            cd project; npm test
Lint:            cd project; npm run lint
Type check:      cd project; npm run typecheck
Build:           cd project; npm run build
Review build:    cd project; npm run build:unpack
Clean handoff:   cd project; npm run export:localrelease
```

The durable PageSpace package contract is in
[`docs/PAGESPACE_PACKAGE_FORMAT.md`](docs/PAGESPACE_PACKAGE_FORMAT.md).

## Security

Imported packages are untrusted static inputs. PageSpace does not execute package-provided build
commands or executables. It previews page code without Node or preload privileges, keeps GitHub
credentials in protected operating-system storage, and publishes only freshly generated output
verified against a private manifest.

The owner's development copy is `project/dist/PageSpace/`. A clean colleague handoff must use
`project/dist/localrelease/PageSpace/`, whose `Pages/` directory is empty.
