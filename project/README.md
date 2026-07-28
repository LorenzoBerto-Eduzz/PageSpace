# PageSpace desktop application

This folder contains the Electron + electron-vite + React + TypeScript source for PageSpace.

PageSpace creates simple local pages and imports static or manifest-editable AI-authored website
packages. It keeps pages local by default, opens exact baked output in the browser, and explicitly
publishes one verified page at a time through the user's connected GitHub account.

## Development

```text
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

## Portable review

```text
npm run build:unpack
```

This creates `dist/PageSpace/PageSpace.exe` and preserves its sibling `Pages/` folder.

Use `npm run export:localrelease` only when the owner requests a clean shareable application
folder. The clean release is created under `dist/localrelease/PageSpace/` with an empty `Pages/`.

See the root documentation for the package contract, security boundary, and delivery rules.
