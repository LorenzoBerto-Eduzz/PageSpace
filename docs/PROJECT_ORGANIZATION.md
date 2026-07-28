# PageSpace Organization Direction

## Repository Frame

```text
PageSpace/
  project/
  asset_staging/
  local_assets/
  docs/
  notes/
  scripts/
```

The outer folder may temporarily retain the former local name until the final repository rename.

## Application Layers

```text
project/src/
  main/
    index.ts
    pagespace-workspace-service.ts
    pagespace-package-service.ts
    pagespace-ai-instructions.ts
    public-site-generator.ts
    github-auth-service.ts
    github-publishing-service.ts
    publication-policy.ts
  preload/
    index.ts
    index.d.ts
  shared/
    page-contracts.ts
    pagespace-package-contracts.ts
  renderer/
    dashboard and settings
    simple editor
    package editor
```

## Ownership

- Renderer: presentation, forms, local UI state, human-readable feedback.
- Preload: narrow typed `window.pageSpace` IPC bridge.
- Main process: dialogs, validated filesystem operations, images, packages, generation, Git,
  GitHub, credentials, preview windows, and external URLs.
- Page package: untrusted static website and declarative editable contract.
- Generated site: viewer-only public output.

## Workspace Shape

```text
PageSpace/
  Pages/
    Stable Page Folder/
      .git/
      .gitignore
      content.json                 private editable instance values
      docs/                        current publishable tree
      .pagespace/
        page.json                  private instance metadata
        preview.png
        package/                   imported fixed package
        user-assets/               sanitized replacement images
        backup/snapshot.json
        generated-site/            verified baked output
        generated-site-manifest.json
```

Simple pages also use `content.json`, `.pagespace/`, generated output, and the same publication
boundary.

## Modularity Rules

- Keep package parsing, schema validation, baking, workspace lifecycle, GitHub authentication, and
  publishing independent from renderer layout.
- Keep the built-in simple editor as one page source, not the universal representation for imported
  pages.
- Add schema field types through shared contracts, validator support, and focused renderer controls.
- Do not let package-provided values or code select filesystem paths or call privileged IPC.
- Keep package-format compatibility versioned independently from application versions.
- Keep intentional legacy migration names confined to migration and cleanup code.
