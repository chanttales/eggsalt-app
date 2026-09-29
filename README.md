# eggsalt-app

A flexible business whiteboard for small businesses: owners draw how their business works (stages, rules, steps) and the app turns it into a working system for orders, stock and money. Web and Android from one codebase.

The first business using it is **Bisnis Telur Asin** (salted duck eggs): warung and catering orders, boiling batches, supplier purchases with a 5-day return rule, HPP and profit per order.

## Stack

Next.js (static export) · Tailwind CSS + shadcn/ui · CapacitorJS (Android) · Supabase (Postgres, Auth, Realtime, Edge Functions) · GitHub Pages + GitHub Actions

## Docs

| Doc | What it covers |
|---|---|
| [PRD](docs/design/01-prd.md) | Problem, requirements, the Telur Asin example and its numbers |
| [Design system](docs/design/02-design-system.md) | Tokens, components, patterns, microcopy |
| [Information architecture](docs/design/03-information-architecture.md) | Sitemap, navigation, screens and routes |
| [User flows](docs/design/04-user-flow.md) | The 11 key flows |
| [Wireframes](docs/design/05-wireframes.html) | Clickable phone prototype (open in a browser) |
| [Technical architecture](docs/design/06-technical-architecture.md) | Hosting, frontend, backend, CI/CD |
| [Data model](docs/design/07-data-model.md) · [schema](docs/design/07-schema.sql) | Tables, ledgers, costing functions |
| [Contributing](CONTRIBUTING.md) | Development workflow and commit rules |
| [Tasks](TASKS.md) | Backlog, one line per commit |

## Status

Design complete (roadmap steps 1–7). Development (step 8) in progress: see [TASKS.md](TASKS.md).
