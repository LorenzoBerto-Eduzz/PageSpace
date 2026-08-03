import {
  PAGESPACE_ALLOWED_SITE_EXTENSIONS,
  PAGESPACE_PACKAGE_LIMITS
} from '../shared/pagespace-package-limits'

export const PAGESPACE_PACKAGE_CONTRACT_VERSION = 'pagespace-package-v1'

export const PAGESPACE_REFERENCE_EDITABLE_SCHEMA = {
  schemaVersion: 1,
  fields: [
    {
      key: 'title',
      type: 'text',
      label: 'Page title',
      required: true,
      maxLength: 100,
      placeholder: 'Type the page title'
    },
    {
      key: 'accentColor',
      type: 'color',
      label: 'Accent color'
    },
    {
      key: 'published',
      type: 'boolean',
      label: 'Show public content'
    },
    {
      key: 'layout',
      type: 'select',
      label: 'Layout',
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'list', label: 'List' }
      ]
    },
    {
      key: 'sections',
      type: 'collection',
      label: 'Sections',
      itemLabel: 'Section',
      maxItems: 30,
      fields: [
        { key: 'heading', type: 'text', label: 'Section heading', required: true, maxLength: 100 },
        {
          key: 'cards',
          type: 'collection',
          label: 'Cards',
          itemLabel: 'Card',
          maxItems: 100,
          fields: [
            { key: 'title', type: 'text', label: 'Card title', maxLength: 120 },
            { key: 'description', type: 'textarea', label: 'Description', maxLength: 500 },
            { key: 'address', type: 'url', label: 'Address' },
            { key: 'image', type: 'image', label: 'Image', altLabel: 'Card image' }
          ]
        }
      ]
    }
  ]
} as const

export const PAGESPACE_REFERENCE_EDITABLE_CONTENT = {
  schemaVersion: 1,
  values: {
    title: 'Example page',
    accentColor: '#345678',
    published: true,
    layout: 'grid',
    sections: [
      {
        _id: 'section-example',
        heading: 'Resources',
        cards: [
          {
            _id: 'card-example',
            title: 'Example card',
            description: 'A seed item that the owner may edit.',
            address: 'https://example.com/',
            image: ''
          }
        ]
      }
    ]
  }
} as const

export function createPageSpaceAiInstructions(appVersion: string): string {
  const limits = PAGESPACE_PACKAGE_LIMITS
  const extensions = PAGESPACE_ALLOWED_SITE_EXTENSIONS.join(', ')
  const schemaExample = JSON.stringify(PAGESPACE_REFERENCE_EDITABLE_SCHEMA, null, 2)
  const contentExample = JSON.stringify(PAGESPACE_REFERENCE_EDITABLE_CONTENT, null, 2)

  return `PAGESPACE PACKAGE DEVELOPMENT SPECIFICATION

Target PageSpace version: ${appVersion}
Required contract: ${PAGESPACE_PACKAGE_CONTRACT_VERSION}
Contract schema version: 1

PURPOSE AND AUTHORITY

This is a normative compatibility specification for humans and AIs creating a page project for
PageSpace. Follow every MUST/MUST NOT rule. Do not guess missing structure. A normal static website
does not need this contract; use it when the page needs PageSpace-aware metadata, compatible source
updates, declared custom editing, baking, and publishing.

PageSpace remains the trusted host. The page project owns all page-specific visuals, rendering,
and editing controls. PageSpace validates declared data, stores the owner's instance values,
generates the browser-ready output, and publishes only that generated output.

DELIVERY ACCEPTANCE CRITERIA

The work is complete only when all are true:
1. The delivered item is one complete folder, not snippets or an explanation.
2. site/index.html opens as a browser-ready static page without a server-side runtime.
3. Every file passes the exact structure, type, size, path, and schema rules below.
4. An editable package renders seed content, responds to PageSpace edit/view messages, sends the
   complete draft after each change, and never exposes editing controls in view mode.
5. Saving can regenerate the visible site solely from validated values and relative package assets.
6. No credentials, machine paths, source-control data, executables, build tools, or private user
   instance values are delivered.

EXACT FOLDER STRUCTURE

PageName/
  pagespace.json                         MUST exist
  editables.json                         MUST exist only for mode "editable"
  content.json                           MUST exist only for mode "editable"
  site/
    index.html                           MUST exist
    page.js                              example name; all public assets stay under site/

The package root itself is selected in PageSpace. Do not wrap it in an additional folder.
The site/ folder MUST be independently static: HTML/CSS/browser JavaScript/assets only.

PACKAGE SAFETY LIMITS

- Maximum public files: ${limits.maxFiles}
- Maximum bytes per file: ${limits.maxFileBytes}
- Maximum total public bytes: ${limits.maxTotalBytes}
- Hidden files or folders beginning with ".": forbidden
- Symbolic links and special filesystem entries: forbidden
- Reserved root site path: user-assets/ (PageSpace creates it for user-selected images)
- Reserved site file: pagespace-content.js (PageSpace generates it; the package MUST NOT include it)
- Executables, node_modules, package build commands, PowerShell/Python scripts, credentials,
  tokens, .git, .env, and machine-specific paths: forbidden
- Allowed public file extensions only: ${extensions}

MANIFEST: pagespace.json

Exact example:
{
  "schemaVersion": 1,
  "packageId": "com.example.resource-board",
  "packageVersion": "1.0.0",
  "name": "Resource Board",
  "description": "Organized links and tools.",
  "mode": "editable",
  "entryPoint": "index.html"
}

Rules:
- schemaVersion MUST be the number 1.
- packageId MUST be 1-128 lowercase ASCII letters/digits/dots/hyphens, start and end with a
  letter or digit, and remain unchanged across compatible updates.
- packageVersion MUST match numeric major.minor.patch, optionally followed by a hyphenated
  prerelease identifier. Increment it for a distributed package update.
- name MUST be non-empty and at most 80 characters.
- description MUST be a string of at most 180 characters; an empty string is allowed.
- mode MUST be exactly "static" or "editable".
- entryPoint MUST be exactly "index.html" and site/index.html MUST exist.

STATIC MODE

Use mode "static" for a finished site that needs organization, local viewing, source refresh, and
GitHub Pages publishing but no PageSpace custom editing. Do not provide editables.json or
content.json. PageSpace copies verified public files and publishes them without privileged package
code or arbitrary build execution.

EDITABLE MODE: editables.json

An editable package MUST provide editables.json and content.json. PageSpace uses editables.json as
the validation and compatible-update contract. The page still MUST implement its own editing UI.

Global schema rules:
- Root shape: { "schemaVersion": 1, "fields": [...] }
- Maximum top-level fields: ${limits.maxTopLevelFields}
- Field keys MUST match [A-Za-z][A-Za-z0-9_-]{0,63} and be unique among siblings.
- label MUST be a non-empty string of at most 80 characters.
- helpText, when supplied, MUST be a string of at most 240 characters.
- required, when supplied, MUST be boolean. Omit it instead of writing false when unnecessary.
- Supported types only: text, textarea, url, color, image, boolean, select, collection.
- Maximum collection nesting depth: ${limits.maxCollectionDepth} collection levels total.
- Maximum fields directly inside one collection item: ${limits.maxCollectionFields}
- maxItems, when supplied, MUST be an integer from 1 through ${limits.maxCollectionItems}.
- A collection without maxItems accepts at most 200 items.
- Collection values MUST be arrays of objects. Each item carries a stable _id containing only
  ASCII letters, digits, underscore, or hyphen, length 1-100. Preserve _id during edits.

Field-specific rules:
- text: string; optional maxLength integer 1-20000; default maximum 240; line breaks become spaces.
- textarea: string; optional maxLength integer 1-20000; default maximum 20000.
- url: string containing only a complete http:// or https:// URL, maximum 2048 characters; an
  empty string is allowed only when not required.
- color: string exactly # followed by six hexadecimal digits, for example #3a67b2.
- image: empty string when optional, otherwise a safe relative path using forward slashes. Never
  use an absolute path, backslash, URL scheme, empty segment, ".", or ".." segment.
- boolean: JSON boolean true or false, never a string.
- select: string equal to one declared option value. options MUST contain 1-100 unique values;
  each value and label MUST be a non-empty string no longer than 100 characters.
- collection: fields MUST contain 1-${limits.maxCollectionFields} valid child field definitions;
  itemLabel is optional; nested collection depth may not exceed ${limits.maxCollectionDepth}.
- placeholder, itemLabel, and image altLabel are optional human-readable strings.

Complete valid editables.json reference:
${schemaExample}

EDITABLE MODE: content.json

content.json is package seed content, never a real user's working database.
Exact root shape: { "schemaVersion": 1, "values": { ... } }

Rules:
- values MUST provide a valid value for every field declared in editables.json.
- Unknown values are not part of the contract and are discarded; declare every persistent value.
- required fields MUST be non-empty.
- Collection _id values MUST be stable and unique in the page's editing logic.
- When releasing a template update, ship updated seed defaults only. Never copy a colleague's
  private values or user-selected assets into content.json or site/.

Complete content.json matching the reference schema:
${contentExample}

BAKING AND PUBLIC RENDERING

Editable site/index.html MUST load the reserved generated content script before page-owned visual
JavaScript:

<script src="./pagespace-content.js"></script>
<script src="./page.js"></script>

PageSpace generates pagespace-content.js during baking. The package MUST NOT include it. It defines:

window.PAGESPACE_CONTENT

Treat that object as read-only. page.js MUST render the complete visible page from these values.
Use a safe local fallback for direct development viewing when PAGESPACE_CONTENT is absent. All
asset paths MUST be relative. A saved image value such as user-assets/abc.png resolves inside the
generated public output. The baked/public view MUST hide editor controls and MUST work as a static
GitHub Pages site with no Electron, Node, filesystem, shell, Git, or GitHub API access.

PAGE-OWNED EDITOR BRIDGE

The PageSpace iframe sends:
{
  "type": "pagespace:editor-state",
  "mode": "edit" or "view",
  "content": { "schemaVersion": 1, "values": { ... } }
}

The page MUST:
- listen for window "message" events;
- ignore messages unless event.source === window.parent;
- accept only the exact message type, mode, schemaVersion, and object-shaped values;
- deep-clone accepted content before editing it;
- show page-owned controls only in mode "edit";
- render the same page design in both modes;
- send the COMPLETE draft after every meaningful edit, never a partial patch:

window.parent.postMessage({
  type: "pagespace:editor-content-change",
  content: { schemaVersion: 1, values: completeValues }
}, "*");

PageSpace treats bridge data as untrusted and validates it only on explicit Save. The page MUST NOT
claim a save succeeded merely because it sent a draft message. Save, bake, and publish are separate
PageSpace owner actions.

IMAGE BRIDGE

To request a user image, send one of:
{
  "type": "pagespace:editor-image-request",
  "requestId": "unique-request-id",
  "source": "clipboard"
}
{
  "type": "pagespace:editor-image-request",
  "requestId": "unique-request-id",
  "source": "file"
}

PageSpace replies with type "pagespace:editor-image-result", the same requestId, and either:
- result: { value: "user-assets/...", previewDataUrl: "data:image/..." }
- error: a user-readable string

Store only result.value in editable content. previewDataUrl is temporary UI data and MUST NOT be
persisted. Match responses by requestId. If the user removes the image, save an empty string when
the image field is optional.

LINK BRIDGE

Inside PageSpace, opening a content link MUST use:
window.parent.postMessage({ type: "pagespace:open-link", url: completeHttpOrHttpsUrl }, "*");

Never request arbitrary protocols. In a normal direct browser view, a standard target="_blank"
link with rel="noopener noreferrer" is allowed.

COMPATIBLE PACKAGE UPDATES

- Keep packageId unchanged.
- Increment packageVersion for each distributed update.
- Keep a field's key, type, and collection nesting stable to preserve its existing value.
- Preserve collection item _id values during ordinary user edits.
- PageSpace starts from new seed defaults, then reconciles compatible owner values by top-level
  key/type and validates the result against the new schema.
- Removing/renaming/changing the type of a field intentionally drops its old value and uses the new
  seed default. Plan migrations conservatively.
- Source-template refresh and in-app Save both bake locally and mark an already-published page as
  having unpublished changes. Publishing is always a separate explicit owner action.

FINAL AI/HUMAN SELF-CHECK - DO NOT DELIVER UNTIL EVERY ITEM PASSES

[ ] Folder root directly contains pagespace.json and site/.
[ ] pagespace.json satisfies every exact manifest rule.
[ ] site/index.html exists and every referenced asset is under site/ using relative paths.
[ ] File count, individual size, total size, extensions, hidden-entry, and symlink rules pass.
[ ] No pagespace-content.js or user-assets/ was supplied by the package.
[ ] Static mode has no editable files; editable mode has both required editable files.
[ ] Every editables.json key/label/type/option/limit/nesting rule passes.
[ ] content.json supplies correctly typed valid defaults for every declared field.
[ ] Every collection seed item has a stable valid _id.
[ ] site/index.html loads pagespace-content.js before page-owned JavaScript.
[ ] Direct browser fallback and baked PAGESPACE_CONTENT rendering both work.
[ ] Edit mode controls are page-owned; view mode contains no visible editor controls.
[ ] Draft messages contain the complete schemaVersion-1 values object.
[ ] Text-field Ctrl+V is not hijacked by image paste handling.
[ ] Image requests match responses by requestId and persist only relative result.value.
[ ] Links use only http/https and the bridge when inside PageSpace.
[ ] No secrets, private user data, machine paths, executables, build scripts, or Git metadata exist.
[ ] A compatible update keeps packageId and stable keys/types/nesting.
[ ] Deliver the complete package folder and state the target PageSpace version ${appVersion}.

If any item cannot be proven, fix the package before returning it. Do not invent unsupported field
types, privileged APIs, build hooks, or filesystem behavior.
`
}
