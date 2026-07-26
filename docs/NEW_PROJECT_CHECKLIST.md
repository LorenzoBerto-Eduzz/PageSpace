# New Project Checklist

Use this checklist when adapting the template into a real project. It is stack-neutral on purpose; add only the project-specific details that are known.

## 1. Identity And Scope

- [x] Rename the outer project folder to `PageMaker`.
- [x] Resolve the project identity placeholders with the PageMaker product facts.
- [x] Keep `project/` as the PageMaker application source root.
- [x] Fill `docs/PROJECT_BRIEF.md` with the purpose, users, current scope, priorities, and non-negotiable constraints.
- [x] Record PageMaker vocabulary in the brief glossary.

## 2. Source And Tooling

- [x] Inspect the real source, package manifests, and configuration files before declaring the stack.
- [x] Record real run, test, lint, format, build, and development commands.
- [x] Update `.gitignore`, `.gitattributes`, and `.editorconfig` for the chosen Electron/TypeScript stack and generated outputs.
- [x] Keep the first source, assets, and static dashboard presentation components organized by responsibility.

## 3. Data, Secrets, And External Services

- [x] Identify credentials, private data, exports, generated files, and machine-local configuration that must remain out of Git.
- [ ] Add safe examples such as `.env.example` only when they help setup.
- [ ] Document important services, file formats, APIs, and deployment dependencies in focused docs when they become real.

## 4. Continuity And Collaboration

- [x] Replace the template snapshot in `docs/AI_HANDOFF.md` with real current state.
- [x] Update `docs/PROJECT_ORGANIZATION.md` with the agreed source direction.
- [x] Keep `notes/` owner-controlled; do not convert scratch notes into AI instructions.
- [x] Use `memcheck` to save settled decisions instead of relying on chat history.

## 5. Git And Remote

- [x] Do not copy `.git/` from the template.
- [x] Ask the owner for the desired Git `user.name` and one `user.email` verified/associated with the intended GitHub account; do not guess them.
- [x] Copy `.git-identity.example` to `.git-identity` and set the one permitted contributor email.
- [x] Immediately after Git is initialized, set clone-local `git config user.name`, set clone-local `git config user.email` to the allowed email, and run `git config core.hooksPath .githooks`.
- [x] Verify `git config user.name`, `git config user.email`, `.git-identity`, and `git config core.hooksPath` before the first project work is checkpointed.
- [x] Initialize Git only in the real copied project.
- [ ] Create/configure the remote only when the owner is ready.
- [x] Make the first focused commit only when explicitly requested.

## 6. Delivery And Verification

- [x] Define the smallest useful smoke test: run the unpacked `PageMaker.exe` after a successful build.
- [x] Document the real validation commands in `docs/PROJECT_BRIEF.md`.
- [x] Decide the approved local-review build process; production release remains undecided.
- [x] Document `localrelease` in `docs/DELIVERY_PROCESS.md` before using it as a named delivery command.
- [x] Keep generated delivery artifacts out of Git unless the project intentionally tracks them.
