# WallAI - AI-Powered Wealth Tracker

A personal finance dashboard powered by AI that helps you track your wealth across bank accounts, crypto holdings, debts, and properties.

## Features

- **Dashboard** - Net worth overview, income vs expenses, asset allocation
- **Bank Accounts** - Import bank statements (CSV/PDF), AI-powered transaction categorization
- **Crypto** - Track holdings with live prices via CoinGecko
- **Debts** - Monitor loans and payment schedules
- **Properties** - Track real estate valuations
- **AI Analysis** - Financial insights powered by Claude (Anthropic)

## Tech Stack

- **Framework:** Next.js 16 + React 19
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js
- **AI:** Anthropic Claude API
- **Styling:** Tailwind CSS v4

## Getting Started

```bash
# Clone
git clone https://github.com/Estreia7/wallai.git
cd wallai

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your database URL and secrets

# Database
npx prisma migrate deploy
npx prisma generate

# Run
npm run dev
```

Open [http://localhost:3000/wallai](http://localhost:3000/wallai)

## Development

See [developer/README.md](developer/README.md) for the full development workflow.

## Plans & Documentation

- `docs/plans/` - Implementation plans for each module
- `docs/specs/` - Design specifications
