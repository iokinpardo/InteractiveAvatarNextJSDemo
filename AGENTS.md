# AGENTS.md — Guide for Coding Agents in This Repo

## Purpose
You are working in a production-ready Next.js 15 demo for the HeyGen Streaming Avatar SDK. Make small, safe, and well-tested changes that preserve backward compatibility unless the task explicitly states otherwise.

## Allowed Scope
- Focus on the app code in `app/` and `components/` plus related configuration (e.g., `styles/`, `tailwind.config.js`, `eslint.config.mjs`).
- Avoid large refactors, dependency upgrades, or sweeping formatting passes.
- Infrastructure (deployment, CI) changes require prior confirmation unless the task explicitly requests them.

## Required Commands
Always prefer **pnpm** (the repo ships a `pnpm-lock.yaml`). Run commands from `package.json`; do not invent new scripts.

| Task | Command |
| --- | --- |
| Install deps | `pnpm install --frozen-lockfile` |
| Type check | `pnpm lint` (ESLint handles TS checking) |
| Build | `pnpm build` |
| Dev server | `pnpm dev` (when manual QA is required) |

> If you add Jest/Playwright/etc., expose the script as `pnpm test` and document how to run it in the PR.

## Repository Map
- `app/` — App Router entry points, API route for HeyGen token minting, shared layout/fonts.
- `components/InteractiveAvatar.tsx` — Bootstraps the streaming session and composes the main UI shell.
- `components/AvatarSession/` — Video player, transcript, microphone/voice controls shown during a session.
- `components/AvatarConfig/` — Optional controls for avatar, transport, and voice configuration.
- `components/logic/` — Context provider, hooks, and utilities wrapping the Streaming Avatar SDK.
- `styles/`, `tailwind.config.js`, `postcss.config.js` — Tailwind setup and global styles.

## Coding Conventions
- TypeScript + React 19: follow existing patterns, React hooks, and context usage.
- Tailwind CSS classes should remain scoped; avoid inline styles unless necessary.
- Prefer `use client` boundaries already defined; do not flip server/client component boundaries without justification.
- Keep diffs minimal—only touch lines directly related to the change.
- Add focused comments/docstrings for non-obvious logic, especially around streaming state management.
- Never disable ESLint/TypeScript rules globally. Local `// eslint-disable-next-line` requires a comment explaining why.

## Quality Gates
- Run `pnpm lint` and `pnpm build` before submitting a PR unless the task notes an explicit limitation.
- Add or update tests when you change behavior. If no automation exists yet, describe manual verification steps in the PR.
- Maintain or improve accessibility (ARIA attributes, keyboard interaction) for UI changes.

## Branches & Commits
- Create feature branches using `{type}/{short-topic}-{issue|date}` (e.g., `feat/avatar-config-20250109`).
- Keep commits logical and well-scoped with descriptive messages.

## Pull Requests
Use the template in `.github/pull_request_template.md`. Every PR must:
1. Summarize the change, motivation, and implementation details.
2. List the exact commands run (lint/build/tests) and their results.
3. Call out any manual QA performed.
4. Mention risks, rollback strategy, and whether breaking changes exist.

## Ownership & Reviews
- Core streaming logic (`components/logic/**`) — coordinate with the platform/runtime maintainers if major changes are needed.
- UI components (`components/AvatarSession/**`, `components/AvatarConfig/**`) — coordinate with the frontend maintainers for large redesigns.

## Security & Secrets
- Never commit real API keys. Use `.env.example` patterns and document required variables.
- Token-minting logic must not expose secrets to the client—keep sensitive operations on the server (`app/api/**`).
- Adding dependencies requires justification and a security review note in the PR.

## Risk Management
- Prefer feature flags or configuration toggles for risky changes.
- If you suspect a change might degrade streaming stability, stop and ask for clarification.
- If a task cannot be completed due to missing configuration or third-party limits, document the blocker and suggested remediation.

## Helpful References
- README for architecture overview: `./README.md`
- Tailwind config: `./tailwind.config.js`
- ESLint config: `./eslint.config.mjs`

Keep this guide updated whenever commands, structure, or policies change.
