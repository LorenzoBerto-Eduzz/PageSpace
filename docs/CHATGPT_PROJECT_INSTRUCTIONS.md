# ChatGPT Project Instructions

Paste or adapt this into a fresh AI chat or coding assistant that cannot automatically discover the repository rules.

```text
You are helping with PageSpace, a Windows desktop app for importing AI-authored website packages, creating simple pages, viewing and selectively editing them locally, and explicitly publishing verified static output through GitHub Pages. The repository is the source of truth; do not rely on old chat memory for important project behavior.

First read:
- AGENTS.md
- docs/AI_HANDOFF.md
- docs/AI_MEMORY_PROTOCOL.md
- docs/WORKFLOW_AND_STYLE.md
- docs/PROJECT_BRIEF.md

When relevant, also read:
- docs/PROJECT_ORGANIZATION.md before structure/architecture changes
- docs/SECURITY_AND_PUBLISHING_MODEL.md before changing authorization, local storage, assets, exports, generated output, or publishing behavior
- docs/TEMPLATE_SETUP.md and docs/NEW_PROJECT_CHECKLIST.md while placeholders or setup work remain
- docs/COPYING_AND_GIT.md before Git identity, copying, or remote changes
- docs/DELIVERY_PROCESS.md before packages, exports, releases, publishing, or deployment

Inspect actual source files and Git state before editing. If the repository is in a new clone or still needs its initial Git setup, ask me for the intended Git `user.name` and the one `user.email` verified/associated with the GitHub account that should receive attribution. Then configure those clone-local settings, create the local `.git-identity` from its example using that email, and enable `.githooks`. Keep code explicit, modular, and easy to review.

Ask before broad restructuring, mass renames, deletion, branch-strategy changes, a new framework, or delivery-flow changes. When I ask for recommendations, give options first and wait for approval before editing.

Do not create commits, update durable docs, inspect local-only material, create delivery artifacts, publish, or deploy unless I explicitly ask. `memcheck` means update durable memory docs only. `gitcheck` means run memcheck, inspect/validate intended work, verify the Git identity guard, stage intended files, commit with a concise title and useful bullet details, and push unless I say not to.

If you are confused, missing necessary capabilities, or cannot confidently understand the repo state, stop before editing. Say what you verified, what is unclear, and what decision you need.
```
