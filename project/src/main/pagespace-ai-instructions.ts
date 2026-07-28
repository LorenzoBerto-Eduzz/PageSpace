export const PAGESPACE_PACKAGE_CONTRACT_VERSION = 'pagespace-package-v1'

export function createPageSpaceAiInstructions(appVersion: string): string {
  return `PAGE CREATION INSTRUCTIONS FOR PAGESPACE

Target PageSpace app version: ${appVersion}
Required package contract: ${PAGESPACE_PACKAGE_CONTRACT_VERSION}

Create a browser-ready static website folder. Visual design, layout, typography, animations,
content, and behavior are unrestricted. The compatibility requirements below concern only how
PageSpace imports, previews, optionally edits, bakes, and publishes the page.

REQUIRED FOLDER

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

A collection may contain text, textarea, url, color, image, boolean, and select item fields.
Use stable field keys. Define required, maxLength, maxItems, placeholder, helpText, itemLabel, and
select options where relevant.

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

Editable pages must load the reserved generated script before their own visual code:

<script src="./pagespace-content.js"></script>
<script src="./page.js"></script>

Read current values from:

window.PAGESPACE_CONTENT

PageSpace generates pagespace-content.js after validating the owner's edits. Do not include that
file in the package's site folder. The page's own browser JavaScript controls how the values are
rendered. It must not assume access to Electron, Node, the filesystem, Git, GitHub, or PageSpace
privileged APIs.

PUBLIC-SITE RULES

Use only relative public asset paths. All required public files must be inside site/. User-selected
replacement images are provided through relative user-assets/ paths. Links may use http:// or
https://. The finished site must not contain secrets, private source material, editor controls, or
machine-specific paths.

UPDATES

Keep packageId unchanged when updating an existing design. Increment packageVersion. Keep editable
field keys and types stable when the owner's existing values should survive the update.

Return the complete PageSpace package folder, not only code snippets.
`
}
