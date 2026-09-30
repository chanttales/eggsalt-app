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
- [x] fix(ui): self-host plus jakarta sans instead of fetching google fonts

## M1.2 Domain and data

- [x] build(domain): add packages/domain with typescript and vitest
- [x] feat(domain): add money, quantity and date helpers (IDR, WIB)
- [x] feat(domain): add costing math (lot cost with bonus, batch hpp, order profit)
- [x] test(domain): cover costing with telur asin numbers
- [x] feat(domain): add board graph and rule schemas (zod)
- [x] feat(domain): add rule evaluator
- [x] feat(db): add workspace, member and rls helpers
- [x] feat(db): add parties, items, states, products and prices
- [x] feat(db): add card types, fields, boards and versions
- [x] feat(db): add cards, lines and events
- [x] feat(db): add stock lots, movements and reservations
- [x] feat(db): add money entries and cost allocations
- [x] feat(db): add fifo, purchase, production and return functions
- [x] feat(db): add report views
- [x] feat(db): add notifications and daily cron jobs
- [x] feat(template): seed telur asin template

## M1.3 Engine

- [x] feat(engine): scaffold edge function with auth and membership check
- [x] refactor(domain): use explicit .ts import paths so deno can load it
- [x] feat(db): add keys to boards and items for graph references
- [x] feat(engine): add create-card and move-card with idempotency
- [x] feat(engine): add stock actions (reserve, release, move)
- [x] feat(engine): add receive-stock, produce and return-lot
- [x] feat(db): add other income money kind
- [x] feat(engine): add record-money with cost allocation
- [x] feat(db): skip reversed expenses in order profit
- [x] feat(engine): add undo via compensating actions

## M1.4 Screens

- [x] feat(web): add supabase client, auth and workspace guard
- [x] feat(web): add query client with persistence and outbox
- [x] feat(db): add create workspace from template function
- [x] feat(engine): add opening-stock op
- [x] feat(web): add onboarding with telur asin template
- [x] feat(web): add hari ini screen
- [x] feat(web): add board kanban view
- [x] feat(web): add card detail with stage stepper and profit
- [x] feat(web): add new order sheet
- [x] feat(web): add stock screen with lots and return countdown
- [x] feat(web): add boil batch flow
- [x] feat(web): add receive stock and supplier return flows
- [x] feat(web): add delivery and payment flows
- [x] feat(web): add money screen and expense entry
- [x] feat(web): add profit reports
- [x] feat(web): add board editor (phone list view)
- [x] feat(web): add board editor canvas (web)

## M1.5 Android

- [x] build(mobile): add capacitor with android project
- [x] feat(mobile): add back button, network status and local notifications
- [x] ci(mobile): build and attach signed apk to github releases

## M1.6 Settings and dashboard

- [x] feat(web): add price editor with an effective date
- [x] feat(db): let receive_purchase take a purchase date
- [x] feat(engine): accept a purchase date on receive-stock
- [x] feat(web): add purchase date to receive stock
- [ ] feat(engine): add order date for past sales
- [ ] feat(web): add order date to the new order sheet
- [ ] feat(web): add customer and supplier editor
- [ ] feat(web): add settings menu
- [ ] feat(web): add dashboard with sales, profit and stock trends
