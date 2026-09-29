# CLAUDE.md

Business whiteboard app (first user: Bisnis Telur Asin). Design docs in `docs/design/`, rules in `CONTRIBUTING.md`, backlog in `TASKS.md`.

## Rules (from the owner, always apply)

- One small, focused task at a time: the first unticked line in `TASKS.md`. Finish, verify and commit it before starting the next.
- Change only what the task needs. No unrelated refactors, formatting, dependency updates or features.
- One Conventional Commit per logical change: `type(scope): description`. Scopes: web, mobile, ui, domain, engine, db, template, ci, repo, docs.
- Tick the task line in `TASKS.md` in the same commit.
- Pre-commit hooks must pass; never bypass them with `--no-verify`.
- After each task, report: what was implemented, the commit, the next task.
- The owner does functional testing. Only write unit tests for costing and ledger math in `packages/domain`.

## Project facts

- Next.js static export only (GitHub Pages + Capacitor): no API routes, no server components at runtime, detail pages use query params (`/kartu?id=`).
- Stock and money are ledgers: append-only, written only by the engine Edge Function. Money is integer rupiah. Business time zone is Asia/Jakarta.
- UI text in Bahasa Indonesia first (i18n keys, `id` and `en`).
- Public repo: never commit secrets, `.env` files or business data.
