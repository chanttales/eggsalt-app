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
- [x] feat(db): date a past order's stock and money rows
- [x] feat(engine): add order date for past sales
- [x] feat(web): add order date to the new order sheet
- [x] feat(web): add customer and supplier editor
- [x] feat(web): add settings menu
- [x] feat(web): add dashboard with sales, profit and stock trends

## M1.7 Quantity prices

- [x] feat(db): add minimum quantity to sell prices
- [x] feat(engine): price order lines by quantity
- [x] feat(web): edit and preview quantity prices

## M1.8 Invites

- [x] feat(db): add email invites
- [x] feat(web): join invited workspaces on sign-in
- [x] feat(web): add invites screen

## M1.9 Feedback and errors

- [x] feat(web): show saved message with undo after each change
- [x] feat(web): explain refused changes on every page
- [x] feat(web): add friendly error and not found pages
- [x] feat(web): replace browser confirm dialogs with a sheet
- [x] feat(web): show save results in a dialog
- [x] fix(web): show the result dialog on settings pages
- [x] feat(web): close success dialogs by themselves and escalate failures
- [x] ci(web): pass the developer contact to web and apk builds

## M2.0 EggSalt redesign

- [x] feat(web): switch to the EggSalt blue theme, light mode only
- [x] feat(web): rename the app to EggSalt
- [x] feat(web): add Home with greeting, dates, shortcuts and ongoing orders
- [x] feat(web): add Profil with account, invites, settings and sign out
- [x] feat(web): add Pesanan list for warung and catering orders
- [x] feat(web): add bottom nav with Home, Pesanan, add, Uang and Profil
- [x] feat(web): hide the board editor and use salted egg wording

## M2.1 Layout fixes

- [x] fix(web): remove the guide button from Home
- [x] fix(web): add vertical padding to the bottom nav
- [x] fix(web): tidy the Pesanan and Uang layouts
- [x] fix(web): explain why the engine refused a change
- [x] fix(engine): clear the stock shortage flag once stock covers the order

## M2.2 Order entry

- [x] feat(web): let the add button choose warung order or catering pre-order
- [x] fix(web): ask one date per order type in the new order form
- [x] feat(web): restyle sign in with a blue header and a card
- [x] fix(web): center sign in on a full blue background
- [x] feat(web): hide empty stage chips unless all stages are shown
- [x] feat(web): switch the theme blue to #3DB2FF
- [x] fix(web): make the light blue cards and progress ring stand out
- [x] fix(web): drop the new order button from Pesanan
- [x] feat(web): add the EggSalt logo to sign in and as the app icon
- [x] fix(web): recolor the logo to the #3DB2FF theme blue
- [x] fix(web): list finished orders under Selesai on Pesanan
- [x] fix(web): switch Pesanan and Laporan filters without reloading the page
- [x] feat(web): show skeleton rows while lists load
- [x] fix(web): let the Home date strip show the last two days
- [x] feat(web): add a calendar button to pick any date on Home
- [x] fix(web): keep the Home date button from widening the page
- [x] feat(web): download Laporan as a CSV file for Excel or Google Sheets

## M2.3 Google Sheets

- [x] feat(web): sync Laporan to Google Sheets when the owner taps Sinkron
- [x] feat(web): download Laporan as an Excel file instead of CSV
- [x] fix(engine): use the earliest price for orders dated before it
- [x] feat(web): show each product's price periods as coloured blocks
- [x] feat(web): show price periods on a coloured month calendar
- [x] feat(web): move sell and buy price history to their own page
- [x] feat(web): add a back button to detail and sub-menu pages
- [x] fix(ui): keep the back button on the same line as the page title
- [x] fix(ui): centre the note above page titles
- [x] feat(ui): use a shadcn-style calendar date picker for every date field
- [x] fix(web): move page notes into the ? help button
- [x] fix(ui): hide the back button when there is no earlier page in the app
- [x] feat(template): rename the order boards to Pesanan and Pre-order
