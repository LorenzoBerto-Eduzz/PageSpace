# PageSpace Package Format

## Purpose

PageSpace packages let an AI or another author create a visually unrestricted static website that
PageSpace can import, organize, preview locally, optionally edit through declared fields, bake, and
publish through the user's connected GitHub account.

The package contract controls integration only. It does not prescribe a visual system, framework,
layout, subject, or style.

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
- `collection` containing text, textarea, URL, color, image, boolean, or select fields

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

`content.json` contains the initial values keyed by field:

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
window.PAGESPACE_CONTENT = { /* validated public values */ };
```

The package's own browser JavaScript decides how those values appear. It receives no PageSpace,
filesystem, Electron, Git, or GitHub privileges.

## Package Updates

PageSpace treats a package with the same `packageId` as an update. It replaces the fixed website
template and schema only after validation. Compatible saved values are preserved by stable field
keys and types. New fields receive their new defaults. Removed or incompatible fields are not
silently published.

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
structure, supported field types, validation limits, security restrictions, and a minimal example.
It intentionally contains no visual requirements.
