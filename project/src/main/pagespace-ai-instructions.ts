export const PAGESPACE_PACKAGE_CONTRACT_VERSION = 'pagespace-package-v1'

export function createPageSpaceAiInstructions(appVersion: string): string {
  return `PAGE CREATION INSTRUCTIONS FOR PAGESPACE

Target PageSpace app version: ${appVersion}
Required package contract: ${PAGESPACE_PACKAGE_CONTRACT_VERSION}

Create a browser-ready static website folder. Visual design, layout, typography, animations,
content, and behavior are unrestricted. The compatibility requirements below concern only how
PageSpace imports, previews, optionally edits, bakes, and publishes the page.

PageSpace can organize ordinary browser-ready website folders without this contract. Follow the
contract below when the page should receive declared editing, stable package updates, and full
version-specific PageSpace integration.

PAGESPACE-COMPATIBLE FOLDER

PageName/
  pagespace.json
  site/
    index.html
    all required CSS, browser JavaScript, fonts, images, and other public assets

The site folder must work as a static website and must not require a server-side runtime.
Do not include executables, symlinks, credentials, tokens, private files, node_modules, source
control metadata, PowerShell, Python, or package-provided build commands.

MANIFEST

pagespace.json:
{
  "schemaVersion": 1,
  "packageId": "stable.lowercase.identifier",
  "packageVersion": "1.0.0",
  "name": "Human-readable page name",
  "description": "Short description",
  "mode": "static",
  "entryPoint": "index.html"
}

Use mode "static" when the page is already complete and needs only local viewing, organization,
package replacement, and GitHub Pages publishing.

EDITABLE PACKAGE

Use mode "editable" only when the owner should edit declared values inside PageSpace. Add:

  editables.json
  content.json

Supported editable field types:
  text, textarea, url, color, image, boolean, select, collection

A collection may contain text, textarea, url, color, image, boolean, select, and one nested
collection. The supported maximum is two collection levels, for patterns such as sections with
cards. PageSpace uses this schema for validation and compatible value preservation; the page owns
its editing interface. Use stable field keys. Define required, maxLength, maxItems, placeholder,
helpText, itemLabel, and select options where relevant.

editables.json:
{
  "schemaVersion": 1,
  "fields": [
    {
      "key": "title",
      "type": "text",
      "label": "Page title",
      "required": true,
      "maxLength": 100
    }
  ]
}

content.json:
{
  "schemaVersion": 1,
  "values": {
    "title": "Initial title"
  }
}

content.json contains the package's initial seed values. PageSpace stores the owner's working
values separately from the installed package, including a stable _id on each collection item.
When shipping a compatible update, do not overwrite or embed the owner's instance values in the
new package. PageSpace reconciles them by field key/type and preserves compatible nested items.

Editable pages must load the reserved generated script before their own visual code:

<script src="./pagespace-content.js"></script>
<script src="./page.js"></script>

Read current values from:

window.PAGESPACE_CONTENT

PageSpace generates pagespace-content.js after validating the owner's edits. Do not include that
file in the package's site folder. The page's own browser JavaScript controls how the values are
rendered. It must not assume access to Electron, Node, the filesystem, Git, GitHub, or PageSpace
privileged APIs.

IN-PAGE EDITOR BRIDGE

PageSpace sends the sandboxed page a window message with type "pagespace:editor-state", mode
"edit" or "view", and content shaped as { schemaVersion: 1, values: {...} }. The editable page
must render its own visual controls in edit mode and hide them in view mode. When its draft
changes, send the parent window { type: "pagespace:editor-content-change", content: {
schemaVersion: 1, values: {...} } }. Send the complete values object, not a partial patch.

This bridge carries untrusted data only. It grants no filesystem, Electron, Git, GitHub, shell, or
publication access. PageSpace validates the returned draft against editables.json only when the
owner explicitly saves. Saving and publishing are separate owner actions.

For a user-selected editable image, send { type: "pagespace:editor-image-request", requestId:
"unique-id", source: "clipboard" } or source: "file". PageSpace replies with type
"pagespace:editor-image-result", the same requestId, and result { value, previewDataUrl }, or an
error. Store only the relative value in content; previewDataUrl is temporary display data. To open
an http:// or https:// content link while sandboxed inside PageSpace, send { type:
"pagespace:open-link", url }. These messages do not grant general clipboard, filesystem, or shell
access.

PUBLIC-SITE RULES

Use only relative public asset paths. All required public files must be inside site/. User-selected
replacement images are provided through relative user-assets/ paths. Links may use http:// or
https://. The finished site must not contain secrets, private source material, editor controls, or
machine-specific paths.

UPDATES

Keep packageId unchanged when updating an existing design. Increment packageVersion. Keep editable
field keys, field types, and collection nesting stable when the owner's existing values should
survive the update. Saving edits bakes the local page only; publishing or updating the online page
is a separate explicit owner action.

Return the complete PageSpace package folder, not only code snippets.
`
}
