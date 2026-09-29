# Development Workflow

**Status:** v1 · 2026-09-29
Sections 1 and 2 are the owner's rules. Sections 3 onward are the project conventions built on them. `CLAUDE.md` holds the short version.

---

## 1. Rules (owner-defined)

- Develop the application incrementally, one small and focused task at a time.
- Break large features into smaller, logical implementation steps.
- Complete and verify each step before moving to the next.
- Keep each change limited to the current task. No unrelated refactoring, formatting, dependency updates or feature changes.
- One Conventional Commit per logical change: `type(scope): description`.
- Keep commits small, focused, reviewable and independently revertible.
- Set up automated pre-commit hooks during project initialization to run formatting, linting and other lightweight checks on staged files.
- Block commits automatically when required pre-commit checks fail.
- Keep pre-commit checks fast; run full type-checking, tests and production builds separately through CI or dedicated validation.
- Never implement multiple unrelated features in one commit.
- After each completed task, briefly report what was implemented, the commit created, and the next task.
- Do not move to the next logical task until the current task is complete and committed.

## 2. Roadmap context

Steps: PRD → Design System → IA → User Flow → Wireframes → Technical Architecture → Data Model → **Development** → Testing (owner does this) → Deployment (GitHub-hosted).

---

## 3. Commit convention (added)

**Types:** `feat` · `fix` · `refactor` · `perf` · `style` (formatting only) · `test` · `docs` · `build` (deps, bundler) · `ci` · `chore` · `revert`

**Scopes** (match the monorepo layout from the system design):

| Scope | Area |
|---|---|
| `web` | Next.js app screens and routing |
| `mobile` | Capacitor config and native projects |
| `ui` | Design-system components and tokens |
| `domain` | Shared types, schemas, formula/rule evaluator |
| `engine` | Workflow engine, actions, costing |
| `db` | Supabase migrations, RLS, SQL functions, seed |
| `template` | Business templates (e.g. telur-asin) |
| `ci` / `repo` | GitHub Actions, tooling, root config |
| `docs` | Documentation |

**Format rules:** imperative mood, lowercase, no period, subject ≤ 72 chars. Add a body when the *why* isn't obvious. Breaking changes use `!` (`feat(engine)!: …`) plus a `BREAKING CHANGE:` footer.

Examples:
```
build(repo): initialize pnpm monorepo with next.js app
ci(repo): add husky, lint-staged and commitlint pre-commit hooks
feat(db): add stock_lot and stock_movement tables with rls
feat(engine): compute matang lot unit cost from batch inputs
fix(ui): keep qty stepper from going below zero
```

Enforced by **commitlint** (`@commitlint/config-conventional` + scope enum) in the `commit-msg` hook.

## 4. Pre-commit hooks (added: concrete setup)

Installed in the first development task, before any feature code.

| Hook | Tool | Runs on | Target time |
|---|---|---|---|
| `pre-commit` | **Husky** + **lint-staged** | Staged files only | < 5 s |
| · formatting | Prettier (+ `prettier-plugin-tailwindcss`) | `*.{ts,tsx,js,json,md,css,yml}` | |
| · linting | ESLint (`next/core-web-vitals`, `@typescript-eslint`) with `--max-warnings=0` | `*.{ts,tsx}` | |
| · SQL format | `sql-formatter` (optional) | `supabase/migrations/*.sql` | |
| · secrets | **gitleaks** `protect --staged` (if installed; skip gracefully otherwise) | Staged diff | |
| · file guard | Block files > 500 KB and `.env*` except `.env.example` | Staged files | |
| `commit-msg` | commitlint | Message | < 1 s |

Not in pre-commit (too slow; in CI): full `tsc --noEmit`, tests, `next build`.

## 5. Branching and pull requests (added)

- `main` is always deployable; protected (CI must pass, no force-push).
- One short-lived branch per feature: `feat/<short-name>`, `fix/<short-name>`. A feature branch contains several small commits, one per task.
- Open a PR per feature (not per commit) using the PR template; merge with **rebase or merge commit** (not squash), so the small Conventional Commits survive in history and stay individually revertible.
- Draft PR as soon as the first commit exists, so progress is visible.

## 6. CI (added: GitHub Actions)

`ci.yml` on every push and PR:

1. `pnpm install --frozen-lockfile` (cached)
2. `pnpm lint`
3. `pnpm typecheck` (`tsc --noEmit` across packages)
4. `pnpm test` (unit tests; see §8)
5. `pnpm build` (Next.js static export must succeed)
6. commitlint over the PR's commits

`deploy.yml` on push to `main`: build static export → **GitHub Pages** (`actions/deploy-pages`), with `basePath` set to the repo name. Database migrations are applied manually (or by a separate, manually-triggered workflow) so a web deploy never changes the database by surprise.

## 7. Definition of Done for a task (added)

A task is done and may be committed when:
- [ ] It does exactly the one thing described in the task, nothing more.
- [ ] Pre-commit hooks pass (format, lint, secrets).
- [ ] `pnpm typecheck` passes locally for the touched package.
- [ ] The app still builds if the task touched `apps/web` (`pnpm build`), or the migration applies cleanly on a local Supabase if it touched `db`.
- [ ] Any new env var is added to `.env.example` with a comment.
- [ ] User-facing text goes through i18n keys (id + en), no hardcoded strings.
- [ ] The task line in `TASKS.md` is ticked in the same commit.

## 8. Testing split (added, respecting "owner tests to save tokens")

- **Owner:** functional and exploratory testing of screens and flows (step 9).
- **Claude, minimal and only where a bug would silently cost money:** small unit tests for the costing and ledger math (HPP, FIFO, lot return dates, profit per order) using the confirmed Telur Asin numbers as fixtures. These are cheap to run and protect the numbers the owners rely on. No UI/E2E tests unless asked.

## 9. Task tracking (added)

- `TASKS.md` in the repo root holds the backlog as small tasks grouped by milestone, each sized for one commit, e.g.:
  ```
  ## M1.1 Foundation
  - [ ] build(repo): initialize pnpm monorepo (apps/web, packages/*)
  - [ ] ci(repo): add husky, lint-staged, commitlint, prettier, eslint
  - [ ] ci(repo): add github actions ci workflow
  - [ ] feat(ui): add design tokens and tailwind theme
  ```
- The next task is always the first unticked line; the post-task report quotes it.

## 10. Post-task report format (added: template for rule "report after each task")

```
✓ Done: <one line of what now works>
Commit: <hash> <type(scope): description>
Checks: pre-commit ✓ · typecheck ✓ · build ✓ (or what was skipped and why)
Next: <next task from TASKS.md>
```

## 11. Environment and secrets (added)

- `.env.example` committed; real `.env.local` never committed.
- Supabase anon key is public by design (RLS protects data); the service-role key is never in the client or the repo, only in GitHub Actions secrets if a workflow needs it.
- Separate Supabase projects for `dev` and `prod`.

## 12. Dependencies and versions (added)

- Package manager: **pnpm** with a committed lockfile; Node version pinned in `.nvmrc` and `package.json#engines`.
- Adding a dependency is its own commit (`build(scope): add <pkg> for <reason>`), never mixed into a feature commit.
- No bulk upgrades during feature work; Renovate/Dependabot optional later, grouped weekly.

## 13. Versioning and changelog (optional, added)

Conventional Commits allow automatic `CHANGELOG.md` and version tags via **release-please** on `main`. Worth enabling at the first pilot release, not before.
