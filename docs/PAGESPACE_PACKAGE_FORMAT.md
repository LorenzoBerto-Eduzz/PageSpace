# PageSpace Package Format

## Purpose

PageSpace packages let an AI or another author create a visually unrestricted static website that
PageSpace can import, organize, preview locally, optionally edit through a package-owned editing
extension, bake, and publish through the user's connected GitHub account.

The package contract controls integration only. It does not prescribe a visual system, framework,
layout, subject, or style.

The contract is optional for ordinary browser-ready websites. A folder with a clear HTML entry can
still be imported, organized, viewed, refreshed from the same source folder, and published.
PageSpace recognizes root/common-output entries, one unique nested `index.html`, or one unique
differently named HTML entry. The contract is what adds declared editing and stable
package-version semantics.

## Version 1 Folder Shape

```text
ExamplePage/
  pagespace.json
  site/
    index.html
    styles.css
    page.js
    assets/
  editables.json       required only for editable packages
  content.json         required only for editable packages
```

`site/` must already contain a browser-ready static website. PageSpace never runs package-provided
executables, PowerShell, Python, npm commands, or arbitrary build scripts.

## Manifest

`pagespace.json` uses this shape:

```json
{
  "schemaVersion": 1,
  "packageId": "com.example.resource-hub",
  "packageVersion": "1.0.0",
  "name": "Resource Hub",
  "description": "Team links and dashboards",
  "mode": "editable",
  "entryPoint": "index.html"
}
```

Rules:

- `packageId` is a stable lowercase identifier using letters, numbers, dots, and hyphens.
- `packageVersion` changes when the package design, behavior, defaults, or schema changes.
- `mode` is `static` or `editable`.
- `entryPoint` is currently always `index.html`.
- A package update keeps the same `packageId`.

## Static Packages

A static package is already baked. It has no PageSpace edit form.

PageSpace can import it, preview it, organize it, publish it, and replace it with a newer package
version. Its public output is the validated contents of `site/`.

## Editable Packages

An editable package adds `editables.json` and `content.json`.

`editables.json` declares the controls PageSpace presents. Version 1 supports:

- `text`
- `textarea`
- `url`
- `color`
- `image`
- `boolean`
- `select`
- `collection` containing scalar fields and, at most, one nested collection

Collections support at most two levels, for structures such as sections containing cards. The
schema validates private instance content and reconciles compatible package updates. PageSpace
does not turn the schema into its own generic editing interface: the website renders its declared
editing experience inside its normal page viewport.

Example:

```json
{
  "schemaVersion": 1,
  "fields": [
    {
      "key": "title",
      "type": "text",
      "label": "Page title",
      "required": true,
      "maxLength": 100
    },
    {
      "key": "links",
      "type": "collection",
      "label": "Useful links",
      "maxItems": 200,
      "itemLabel": "Link",
      "fields": [
        {
          "key": "title",
          "type": "text",
          "label": "Title",
          "required": true,
          "maxLength": 100
        },
        {
          "key": "url",
          "type": "url",
          "label": "Address",
          "required": true
        }
      ]
    }
  ]
}
```

`content.json` contains seed values for a first import, keyed by field:

```json
{
  "schemaVersion": 1,
  "values": {
    "title": "Resource Hub",
    "links": []
  }
}
```

The website reads generated editable values from `pagespace-content.js`:

```html
<script src="./pagespace-content.js"></script>
<script src="./page.js"></script>
```

PageSpace generates that reserved file while baking:

```js
window.PAGESPACE_CONTENT = {/* validated public values */};
```

The package's own browser JavaScript decides how those values appear. It receives no PageSpace,
filesystem, Electron, Git, or GitHub privileges.

### In-page editor bridge

When PageSpace opens an editable package, it starts in edit mode and sends the sandboxed page:

```js
{
  type: 'pagespace:editor-state',
  mode: 'edit', // or 'view'
  content: { schemaVersion: 1, values: { /* current private values */ } }
}
```

The package owns all visual controls and page-specific behavior. When its draft changes, it sends
the parent window the full draft:

```js
{
  type: 'pagespace:editor-content-change',
  content: { schemaVersion: 1, values: { /* updated values */ } }
}
```

PageSpace accepts messages only from the currently opened sandboxed page frame. Draft messages
have no filesystem, Git, GitHub, or publication authority. `Salvar` validates them against
`editables.json`, stores private content, backs up the prior state, and bakes public output.
`Visualizar` hides the package-owned controls while retaining the current unsaved draft onscreen.
Publication remains a separate explicit action.

An editable page may request a user image with `pagespace:editor-image-request`, a unique
`requestId`, and source `clipboard` or `file`. PageSpace reads the Windows clipboard or opens the
native file picker, safely decodes/re-encodes the selected image, stores it as a private user asset,
and replies with `pagespace:editor-image-result`, the same `requestId`, a relative saved `value`,
and a temporary `previewDataUrl`. The page stores only `value` in its content. To open a declared
HTTP(S) link from the sandboxed PageSpace viewport, the page sends `pagespace:open-link`; PageSpace
validates the protocol before handing it to the operating system. These are narrow capabilities,
not general Electron, clipboard, filesystem, or shell access.

## Package Updates

PageSpace treats a package with the same `packageId` as an update. It replaces the fixed website
template and schema only after validation. Compatible saved values are preserved by stable field
keys, types, collection nesting, and stable collection item `_id` values. The owner's working
content is stored separately from the installed package. New fields receive their new defaults.
Removed or incompatible fields are not silently published. Saving validates and bakes locally;
publishing that saved result is a separate explicit action.

## Import And Publication Safety

PageSpace:

- rejects symbolic links, executables, hidden control data, and path traversal;
- allows only explicitly supported static website file types;
- limits file count and total package size;
- sanitizes user-selected replacement images before baking;
- previews imported code without Node or preload privileges;
- starts every imported page local-only;
- writes public output into a fresh generated directory;
- verifies generated hashes and paths before publication;
- publishes only generated output, never the editable package or private metadata.

## AI Authoring Instructions

Every PageSpace release exposes one TXT download containing AI-authoring instructions for the
package contract supported by that installed application version. The generated file includes this
structure, every supported field type, exact validation limits, complete nested editable examples,
editor/image/link bridge protocols, compatible-update rules, security restrictions, and a final
delivery checklist. Shared constants keep the document's limits aligned with runtime validation,
and automated tests pass its reference schema and content through the real parser. It intentionally
contains no visual requirements.
