# WallAI — Personal Wealth Tracker Design Spec

**Date:** 2026-04-11
**Status:** Approved
**App:** WallAI (inside playground.bruno-dev.xyz)

---

## 1. Overview

WallAI is a personal finance app that tracks a user's complete financial picture: bank accounts, crypto portfolio, debts (mortgage, loans, credit cards), and property valuations. It uses the Anthropic API (Claude) to parse bank statements and provide AI-powered financial insights. It includes a financial education section with book recommendations and proven strategies.

## 2. Architecture

**Approach:** Monolith Next.js — everything in the existing Next.js 16 app. API routes handle the backend, Prisma ORM for PostgreSQL, NextAuth for authentication.

**Why:** Single deployment, single codebase, already running on the VPS. API routes are sufficient for the scope. No need for a separate backend or external managed DB.

## 3. Pages & Navigation

| Route | Purpose |
|---|---|
| `/wallai` | Login (NextAuth) |
| `/wallai/dashboard` | Net worth overview — total wealth, balances, debts, crypto, property, recent transactions, daily tip/quote |
| `/wallai/bank` | Upload bank statements (PDF/CSV/Excel), view/categorize/filter transactions |
| `/wallai/crypto` | Manual crypto portfolio — coin, quantity, buy price. Live market prices, P&L |
| `/wallai/debts` | Mortgage + loans + credit cards — balances, rates, payments, amortization |
| `/wallai/property` | Property valuation history — manual entry with date log, equity calc |
| `/wallai/analysis` | AI insights (cached summary) + finance chat with Claude |
| `/wallai/learn` | Books (5/year), proven strategies, investment education |
| `/wallai/settings` | Profile, currency, API key, usage tracking, account management |

**Navigation:** Desktop sidebar, mobile hamburger menu (existing pattern). Updated with all pages.

## 4. Database Schema (PostgreSQL via Prisma)

### Users & Auth

- **User** — id, name, email, passwordHash, primaryCurrency (default EUR), createdAt
- NextAuth managed tables: Account, Session, VerificationToken

### Bank & Transactions

- **BankAccount** — id, userId, name (e.g. "CGD Main"), currency, createdAt
- **BankStatement** — id, userId, bankAccountId, fileName, fileType (pdf/csv/excel), uploadedAt, rawStoragePath
- **Transaction** — id, userId, bankAccountId, statementId (nullable for manual entries), date, description, amount, currency, category, notes

### Crypto

- **CryptoHolding** — id, userId, coin (e.g. "BTC"), quantity, buyPrice, buyCurrency, dateAdded, notes

### Debts

- **Debt** — id, userId, name, type (mortgage/loan/credit_card/other), originalAmount, currentBalance, interestRate, monthlyPayment, currency, startDate, endDate, notes
- **DebtPayment** — id, debtId, date, amount, principal, interest, notes

### Property

- **Property** — id, userId, name, currency, debtId (nullable — links to mortgage for equity calc)
- **PropertyValuation** — id, propertyId, estimatedValue, date, notes

### AI & Usage

- **AnalysisCache** — id, userId, summary (JSON), generatedAt
- **ChatMessage** — id, userId, role (user/assistant), content, createdAt
- **ApiUsage** — id, userId, endpoint (parse-statement/analysis/chat), model, inputTokens, outputTokens, estimatedCost, createdAt

### Education

- **Book** — id, title, author, coverUrl, description, year, category (investing/mindset/budgeting), link
- **FinancialTip** — id, content, type (advice/quote), author (nullable), category

## 5. External APIs & Integrations

| Service | Purpose | Auth |
|---|---|---|
| Anthropic API | PDF parsing (vision), transaction categorization, AI analysis, finance chat | User's own key, encrypted in DB (AES-256) |
| CoinGecko API (free) | Live crypto prices, coin search/autocomplete | No key, rate-limited ~30 req/min |
| Frankfurter API (free) | Currency conversion for multi-currency totals | No key |

### Bank Statement Processing Flow

1. User uploads PDF or CSV/Excel
2. CSV/Excel: parsed server-side with `papaparse` (CSV) or `xlsx` (Excel)
3. PDF: sent to Claude API with vision — extracts transactions as structured JSON (date, description, amount, currency)
4. User reviews parsed transactions in a preview table before confirming import
5. Confirmed transactions saved to DB, linked to statement and bank account

### API Key Storage

- Entered in Settings page
- Encrypted at rest using AES-256 (Node.js crypto module)
- Decrypted only when making API calls
- Never exposed to the frontend after initial entry

## 6. Dashboard — Wealth Overview

### Top: Net Worth

- Big number: (bank balances + crypto value + property value) - (total debts)
- Change from last month (% and absolute)
- Currency toggle (EUR, USD, etc.)

### Stat Cards (4)

- Total cash (sum of bank accounts)
- Crypto portfolio value (live prices)
- Property equity (value minus linked mortgage)
- Total debt outstanding

### Charts

- Net worth trend over time (area chart)
- Monthly income vs expenses (bar chart from transactions)
- Asset allocation donut (cash / crypto / property)

### Below Charts

- Recent transactions (last 5-10)
- Financial tip/quote of the session (random from FinancialTip table, rotates per login)

### Data Freshness

Each card shows when data was last updated (e.g. "Bank: 2 days ago", "Crypto: live").

## 7. AI Analysis & Chat

### Section A: Financial Insights (cached)

User clicks "Generate Analysis". Claude receives full financial snapshot and returns structured insights:

- **Quick Wins** — immediate actionable improvements
- **Savings Opportunities** — spending pattern analysis
- **Debt Strategy** — avalanche vs snowball recommendation based on actual rates
- **Investment Ideas** — based on savings rate and current allocation
- **Future Planning** — projections (debt-free date, savings goals)

Cached in `AnalysisCache`. Shows immediately on page load with timestamp. "Refresh Analysis" button regenerates.

### Section B: Finance Chat

Chat interface. Claude has full financial context in system prompt. User asks natural language questions about their finances. Chat history saved in `ChatMessage`.

### Cost Tracking

Both sections log tokens to `ApiUsage`. Visible in Settings — total cost this month, breakdown by feature, usage over time chart.

## 8. Learn — Financial Education

### Section A: Books to Read

- Card grid: cover, title, author, description, link
- 5 books per year recommendation
- Grouped by category (investing, mindset, budgeting)
- Seeded with starter list, manageable from Settings/DB

### Section B: Proven Financial Strategies

Interactive cards/accordion with personalized context:

- 50/30/20 Rule (with user's actual income numbers)
- Pay Yourself First
- Emergency Fund (3-6 months target)
- Debt Snowball vs Avalanche
- Compound Interest (visualized)
- Dollar Cost Averaging

### Section C: Investment Ideas (educational)

General education on investment types: index funds/ETFs, real estate, crypto, bonds, retirement accounts. Educational framing, not financial advice.

## 9. Authentication

- NextAuth.js v5 with Prisma adapter
- Credentials provider (email + password, hashed with bcrypt)
- Option to add OAuth providers (Google, GitHub) later
- Session-based auth with JWT
- Protected routes: all `/wallai/*` except `/wallai` (login)

## 10. Multi-Currency

- Each entity stores its own currency
- User sets a primary display currency in Settings
- Frankfurter API provides conversion rates
- Dashboard and net worth calculations convert everything to primary currency
- Rates cached with TTL (refresh every few hours)

## 11. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (existing) |
| Styling | Tailwind CSS 4 (existing) |
| Charts | Recharts (existing) |
| Auth | NextAuth.js v5 + Prisma adapter |
| Database | PostgreSQL (on VPS) |
| ORM | Prisma |
| File uploads | Next.js API routes + local storage (`/var/www/playground/uploads/`) |
| PDF parsing | Anthropic API (Claude vision) |
| CSV/Excel parsing | papaparse + xlsx |
| Crypto prices | CoinGecko free API |
| Currency conversion | Frankfurter API |
| AI analysis & chat | Anthropic API |
| Encryption | AES-256 via Node.js crypto |

## 12. Project Structure

```
src/
  app/
    wallai/
      page.tsx                  (login)
      layout.tsx                (shared layout + auth provider)
      dashboard/page.tsx
      bank/page.tsx
      crypto/page.tsx
      debts/page.tsx
      property/page.tsx
      analysis/page.tsx
      learn/page.tsx
      settings/page.tsx
  lib/
    prisma.ts                  (prisma client singleton)
    anthropic.ts               (claude API wrapper + usage logging)
    crypto-prices.ts           (coingecko client)
    currency.ts                (exchange rate client + caching)
    encryption.ts              (API key encrypt/decrypt)
    statement-parser.ts        (PDF + CSV/Excel parsing orchestrator)
  components/
    wallai/                    (shared UI — glass cards, nav, charts, forms)
  api/
    wallai/                    (API routes: CRUD, uploads, AI endpoints)
prisma/
  schema.prisma
```

## 13. Design System

- **Style:** Glassmorphism + gradients (existing)
- **Background:** Deep navy (#0A0E1A) with colored gradient orbs
- **Glass cards:** backdrop-blur-xl, bg-white/5, border-white/10
- **Accent:** Emerald-to-cyan gradient (primary), violet, amber (secondary)
- **Responsive:** Mobile-first, sidebar on desktop, hamburger on mobile
