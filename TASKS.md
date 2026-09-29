# Tasks

One line = one commit. The next task is the first unticked line. Tick the line in the same commit that completes it.

## M1.1 Foundation

- [x] docs(repo): add design documents, workflow and task backlog
- [x] build(repo): initialize pnpm monorepo with next.js static app
- [x] ci(repo): add prettier, eslint, husky, lint-staged and commitlint
- [x] ci(repo): add github actions ci workflow
- [x] feat(ui): add design tokens, fonts and tailwind theme
- [x] feat(web): add app shell with bottom tab bar and routes
- [x] ci(repo): deploy static export to github pages
- [x] build(db): initialize supabase project and local config

## M1.2 Domain and data

- [x] build(domain): add packages/domain with typescript and vitest
- [x] feat(domain): add money, quantity and date helpers (IDR, WIB)
- [ ] feat(domain): add costing math (lot cost with bonus, batch hpp, order profit)
- [ ] test(domain): cover costing with telur asin numbers
- [ ] feat(domain): add board graph and rule schemas (zod)
- [ ] feat(domain): add rule evaluator
- [ ] feat(db): add workspace, member and rls helpers
- [ ] feat(db): add parties, items, states, products and prices
- [ ] feat(db): add card types, fields, boards and versions
- [ ] feat(db): add cards, lines and events
- [ ] feat(db): add stock lots, movements and reservations
- [ ] feat(db): add money entries and cost allocations
- [ ] feat(db): add fifo, purchase, production and return functions
- [ ] feat(db): add report views
- [ ] feat(db): add notifications and daily cron jobs
- [ ] feat(template): seed telur asin template

## M1.3 Engine

- [ ] feat(engine): scaffold edge function with auth and membership check
- [ ] feat(engine): add create-card and move-card with idempotency
- [ ] feat(engine): add stock actions (reserve, release, move)
- [ ] feat(engine): add receive-stock, produce and return-lot
- [ ] feat(engine): add record-money with cost allocation
- [ ] feat(engine): add undo via compensating actions

## M1.4 Screens

- [ ] feat(web): add supabase client, auth and workspace guard
- [ ] feat(web): add query client with persistence and outbox
- [ ] feat(web): add onboarding with telur asin template
- [ ] feat(web): add hari ini screen
- [ ] feat(web): add board kanban view
- [ ] feat(web): add card detail with stage stepper and profit
- [ ] feat(web): add new order sheet
- [ ] feat(web): add stock screen with lots and return countdown
- [ ] feat(web): add boil batch flow
- [ ] feat(web): add receive stock and supplier return flows
- [ ] feat(web): add delivery and payment flows
- [ ] feat(web): add money screen and expense entry
- [ ] feat(web): add profit reports
- [ ] feat(web): add board editor (phone list view)
- [ ] feat(web): add board editor canvas (web)

## M1.5 Android

- [ ] build(mobile): add capacitor with android project
- [ ] feat(mobile): add back button, network status and local notifications
- [ ] ci(mobile): build and attach signed apk to github releases
