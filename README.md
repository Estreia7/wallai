# Wallai

**Your money, understood by AI.**

Wallai connects your bank accounts, budgets, crypto, debts and property into one calm dashboard — then uses Claude to explain what's actually happening with your money. Import a bank statement, and Wallai categorizes every transaction, learns your merchants, detects recurring bills, and rolls everything up into a single net-worth figure.

---

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | Single net-worth figure across cash, crypto, debts and property, with income vs. expenses and asset allocation. |
| **Bank & Transactions** | Import statements (CSV / XLSX / PDF), auto-deduplicated and categorized. Correct a category once and Wallai remembers the merchant. |
| **Smart categorization** | Seeded merchant dictionary + fuzzy matching + per-user learned rules, with confidence scoring. Falls back to Claude only when needed. |
| **Recurring bills** | Auto-detects subscriptions and utilities, surfaces them as to-dos to confirm. |
| **Budget** | Per-category limits, month-to-date tracking, and a money-flow (Sankey) view that makes spending leaks obvious. |
| **Crypto** | Track holdings with live prices via CoinGecko, valued in your primary currency. |
| **Debts** | Loans, interest rates, payment schedules, and payoff tracking. |
| **Property** | Real-estate valuations over time, optionally linked to a mortgage debt. |
| **AI Analysis** | Financial insights and a chat assistant powered by Claude, with per-request token/cost usage tracking. |
| **Learn** | A personal-finance reading list with AI-assisted book recommendations. |
| **Net-worth history** | Daily snapshots so you can see the trend, not just the moment. |

Authentication supports **email + password** and **Sign in with Google**.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js v5 (Credentials + Google)
- **AI:** Anthropic Claude API
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts + a custom Sankey layout engine
- **Statement parsing:** `papaparse`, `xlsx`, `unpdf`

---

## Getting Started

### Prerequisites

- **Node.js 24+**
- **Docker** (for the local Postgres) or an existing PostgreSQL instance

### 1. Clone & install

```bash
git clone https://github.com/Estreia7/wallai.git
cd wallai
npm install
```

### 2. Start a local database

The included `docker-compose.yml` spins up Postgres 16 for development:

```bash
docker compose up -d
```

> Production runs its own Postgres on the VPS — this compose file is for local dev only.

### 3. Configure environment

```bash
cp .env.example .env
```

Then fill in `.env`:

```env
# Database (matches docker-compose defaults)
DATABASE_URL="postgresql://wallai:wallai@localhost:5432/wallai"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="run: openssl rand -base64 32"

# Anthropic (optional — users can also add their own key in-app)
ANTHROPIC_API_KEY="sk-ant-..."

# Google sign-in (optional — the button is hidden until these are set)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

### 4. Set up the database

```bash
npx prisma migrate dev     # apply migrations
npx prisma generate        # generate the client
npx prisma db seed         # seed books + default categories
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the marketing landing page — and sign up at [/login](http://localhost:3000/login) to reach the dashboard.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npx prisma migrate dev` | Apply migrations locally |
| `npx prisma db seed` | Seed books and default categories |
| `npx prisma studio` | Browse the database in a GUI |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/            # Authenticated app: dashboard, bank, budget,
│   │                     #   crypto, debts, property, analysis, learn, settings
│   ├── api/wallai/       # REST API routes for every module
│   ├── login/            # Auth page (email/password + Google)
│   └── page.tsx          # Public marketing landing page
├── components/wallai/    # UI components
└── lib/wallai/
    ├── knowledge/        # Categorization, merchant matching, bill detection
    ├── crypto/           # CoinGecko integration
    └── learn/            # Reading-list logic
prisma/
├── schema.prisma         # Data model
├── migrations/           # SQL migrations
└── seed.ts               # Seed script
```

---

## Documentation

- [`developer/README.md`](developer/README.md) — full development workflow
- [`docs/DESIGN.md`](docs/DESIGN.md) — design system
- [`docs/plans/`](docs/plans/) — implementation plans per module
- [`docs/specs/`](docs/specs/) — design specifications

---

## Deployment

The app is deployed to a self-hosted VPS via GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) on push to `main`.
