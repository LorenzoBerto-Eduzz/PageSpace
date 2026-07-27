# PageMaker Security And Publishing Model

PageMaker is business-grade local software. A generated website or exported ZIP must contain only material the user intentionally placed on that website. This document is the durable boundary for implementation and review.

## Website States

### Local-only

- Default state for every new card.
- Stored only in PageMaker's controlled local workspace and application data.
- Has no GitHub repository, remote, public URL, or network publishing action. It may have a local Git repository initialized only for future app-managed history and publishing.
- May be previewed locally and exported as a sanitized static ZIP.

### Public online

- Reached only through the deliberate `Publicar online` flow.
- Requires a global GitHub account connection and a clear confirmation of the card, account, repository, URL, and public content.
- Creates/configures only the selected card's GitHub repository and Pages deployment, then publishes that card's generated output.

Local-only is not internet access control. Authenticated/private online hosting is a separate future capability.

## One-Way Public Output Boundary

1. The generator starts with an empty temporary output folder.
2. It accepts only a validated content model, fixed selected-template files, and assets explicitly attached to the active website.
3. It writes an output manifest of allowed files and validates the generated folder against it.
4. It sanitizes image metadata, including EXIF/GPS where applicable, before output.
5. Publishing and ZIP export consume only the verified generated folder, never the app root, workspace root, arbitrary local folders, drafts, or configuration directories.

The following must never be emitted: the dashboard/editor, Electron source, logs, local paths, app settings, drafts, Git state, credentials/tokens, account profile data, machine metadata, internal files, or unrelated assets.

Dashboard previews stored as `.pagemaker/preview.png` are private app metadata. They are generated from validated saved content for card display and must never be copied into public output.

For the first publishing version, the generated output may contain only static files rendered from the validated title/layout model and explicitly referenced public assets. The page workspace itself—including `.git/`, `.pagemaker/`, editable `data.json`, previews, and editor state—is never the publishing source.

The current generator stores verified `index.html` and `styles.css` under `.pagemaker/generated-site/` and keeps its integrity manifest outside that directory. Regeneration starts from a new temporary directory and atomically replaces prior output. Dashboard previews render from these exact files.

## Credentials And Authorization

- GitHub connection is global to the PageMaker installation and uses a secure browser-based authorization flow.
- Tokens and other secrets use protected operating-system storage only. Never place them in normal JSON configuration, remote URLs, generated files, ZIPs, source-controlled files, or logs.
- The current Windows implementation uses GitHub OAuth Device Flow with the public `public_repo` scope and stores the token through Electron `safeStorage`/Windows DPAPI. The token never crosses preload into the renderer.
- The user code may be displayed/copied because it is temporary authorization state; the device code and resulting access token remain main-process-only.
- Disconnecting locally removes the protected credential from that computer. GitHub-side authorization remains independently reviewable/revocable from the user's GitHub account settings.
- Renderer code has no direct access to secrets, filesystem paths beyond explicit results, shell commands, or Git/GitHub clients.
- The Electron main process owns privileged work; preload exposes only narrow, validated IPC operations.

## Reliability Requirements

- Validate data and URLs before save, export, or publish.
- Use atomic writes and recoverable local backups for editable state and generated output.
- Keep per-card publish status/history and show human-friendly progress plus redacted technical details.
- Make retries safe and avoid empty commits or duplicate remote configuration.
- Never automatically resolve merge conflicts or silently change a site's visibility.
- Local page deletion uses the Windows Recycle Bin. It never deletes a remote repository. Any future remote deletion must be a separate, strongly confirmed GitHub operation.
- Recovery uses one private validated previous snapshot of page metadata and editable content. Damaged current files are never automatically replaced; restoration requires an explicit user action.
- Test generation, manifest validation, asset sanitization, local export, publish failures, and recovery paths.

## Application Form

Electron desktop is the primary release form because it provides the secure local backend needed for filesystem, credentials, GitHub, Git, and publishing work.

A future browser interface is possible only as an installed PageMaker local service. It must bind to loopback only, authenticate local sessions, avoid outside-network exposure, and preserve the same main-process security boundary. A standalone `file://` page or ordinary bookmark cannot replace the installed backend.
