# WallAI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up PostgreSQL database, Prisma ORM, NextAuth authentication, shared WallAI layout with responsive navigation, and placeholder pages for all routes.

**Architecture:** Monolith Next.js 16 app at `/var/www/playground`. PostgreSQL 16 already running on the VPS. Prisma ORM for schema management and queries. NextAuth v5 (next-auth@beta) with Prisma adapter and credentials provider. Shared layout wraps all `/wallai/*` pages with sidebar (desktop) and hamburger menu (mobile).

**Tech Stack:** Next.js 16, PostgreSQL 16, Prisma 6, NextAuth v5, bcrypt, Tailwind CSS 4, TypeScript 5

**Spec:** `docs/superpowers/specs/2026-04-11-wallai-wealth-tracker-design.md`

---

## File Structure

```
prisma/
  schema.prisma                          (CREATE — full database schema)

src/
  lib/
    prisma.ts                            (CREATE — Prisma client singleton)
    auth.ts                              (CREATE — NextAuth config + providers)
  
  app/
    api/
      auth/[...nextauth]/route.ts        (CREATE — NextAuth API route handler)
      wallai/seed/route.ts               (CREATE — seed endpoint for initial admin user)

    wallai/
      layout.tsx                         (CREATE — shared layout with auth + nav)
      page.tsx                           (MODIFY — replace hardcoded login with NextAuth credentials)
      dashboard/page.tsx                 (MODIFY — replace sessionStorage auth with NextAuth session)
      bank/page.tsx                      (CREATE — placeholder)
      crypto/page.tsx                    (CREATE — placeholder)
      debts/page.tsx                     (CREATE — placeholder)
      property/page.tsx                  (CREATE — placeholder)
      analysis/page.tsx                  (CREATE — placeholder)
      learn/page.tsx                     (CREATE — placeholder)
      settings/page.tsx                  (CREATE — placeholder)

  components/
    wallai/
      nav-sidebar.tsx                    (CREATE — desktop sidebar, extracted from dashboard)
      nav-mobile.tsx                     (CREATE — mobile header + hamburger menu)
      glass-card.tsx                     (CREATE — reusable glass card component)
      gradient-bg.tsx                    (CREATE — shared gradient background)

.env                                     (CREATE — database URL, NextAuth secret)
```

---

## Task 1: PostgreSQL Database Setup

**Files:**
- Create: `.env`

- [ ] **Step 1: Create the PostgreSQL database and user**

Run:
```bash
sudo -u postgres psql -c "CREATE DATABASE wallai;"
sudo -u postgres psql -c "CREATE USER wallai_user WITH ENCRYPTED PASSWORD 'wallai_dev_2026';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE wallai TO wallai_user;"
sudo -u postgres psql -d wallai -c "GRANT ALL ON SCHEMA public TO wallai_user;"
```

Expected: Each command outputs `CREATE DATABASE`, `CREATE ROLE`, `GRANT`.

- [ ] **Step 2: Verify connection**

Run:
```bash
psql -U wallai_user -d wallai -h localhost -c "SELECT 1;"
```

Expected: Returns a row with `1`. If prompted for password, enter `wallai_dev_2026`.

- [ ] **Step 3: Create .env file**

Create `/var/www/playground/.env`:
```env
DATABASE_URL="postgresql://wallai_user:wallai_dev_2026@localhost:5432/wallai"
NEXTAUTH_SECRET="generate-a-random-32-char-string-here"
NEXTAUTH_URL="https://playground.bruno-dev.xyz"
```

Generate the secret with:
```bash
openssl rand -base64 32
```

Then paste the output as the NEXTAUTH_SECRET value.

- [ ] **Step 4: Add .env to .gitignore**

Verify `.env` is already in `/var/www/playground/.gitignore`. If not, append it:
```
.env
.env.local
```

- [ ] **Step 5: Commit**

```bash
cd /var/www/playground
git add .gitignore
git commit -m "chore: ensure .env is gitignored"
```

---

## Task 2: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Prisma, NextAuth, and bcrypt**

Run:
```bash
cd /var/www/playground
npm install prisma --save-dev
npm install @prisma/client next-auth@beta @auth/prisma-adapter bcryptjs
npm install @types/bcryptjs --save-dev
```

Expected: Clean install, packages added to `package.json`.

- [ ] **Step 2: Initialize Prisma**

Run:
```bash
cd /var/www/playground
npx prisma init
```

Expected: Creates `prisma/schema.prisma` and updates `.env` if not present. If `prisma/schema.prisma` already exists, skip this step.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add package.json package-lock.json prisma/schema.prisma
git commit -m "chore: install prisma, next-auth, bcryptjs dependencies"
```

---

## Task 3: Prisma Schema

**Files:**
- Create/Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the full schema**

Write `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── NextAuth tables ──────────────────────────────────

model User {
  id              String    @id @default(cuid())
  name            String?
  email           String    @unique
  emailVerified   DateTime?
  image           String?
  passwordHash    String?
  primaryCurrency String    @default("EUR")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  accounts        Account[]
  sessions        Session[]

  bankAccounts    BankAccount[]
  bankStatements  BankStatement[]
  transactions    Transaction[]
  cryptoHoldings  CryptoHolding[]
  debts           Debt[]
  properties      Property[]
  analysisCache   AnalysisCache[]
  chatMessages    ChatMessage[]
  apiUsages       ApiUsage[]

  // Encrypted Anthropic API key
  anthropicKeyEncrypted String?
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ── Bank & Transactions ──────────────────────────────

model BankAccount {
  id        String   @id @default(cuid())
  userId    String
  name      String
  currency  String   @default("EUR")
  createdAt DateTime @default(now())

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  statements   BankStatement[]
  transactions Transaction[]
}

model BankStatement {
  id             String   @id @default(cuid())
  userId         String
  bankAccountId  String
  fileName       String
  fileType       String   // "pdf", "csv", "excel"
  uploadedAt     DateTime @default(now())
  rawStoragePath String

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  bankAccount BankAccount  @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  transactions Transaction[]
}

model Transaction {
  id            String   @id @default(cuid())
  userId        String
  bankAccountId String
  statementId   String?
  date          DateTime
  description   String
  amount        Float
  currency      String   @default("EUR")
  category      String?
  notes         String?
  createdAt     DateTime @default(now())

  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  bankAccount BankAccount    @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  statement   BankStatement? @relation(fields: [statementId], references: [id], onDelete: SetNull)
}

// ── Crypto ───────────────────────────────────────────

model CryptoHolding {
  id          String   @id @default(cuid())
  userId      String
  coin        String   // e.g. "BTC", "ETH"
  quantity    Float
  buyPrice    Float
  buyCurrency String   @default("USD")
  dateAdded   DateTime @default(now())
  notes       String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ── Debts ────────────────────────────────────────────

model Debt {
  id             String   @id @default(cuid())
  userId         String
  name           String
  type           String   // "mortgage", "loan", "credit_card", "other"
  originalAmount Float
  currentBalance Float
  interestRate   Float
  monthlyPayment Float
  currency       String   @default("EUR")
  startDate      DateTime
  endDate        DateTime?
  notes          String?
  createdAt      DateTime @default(now())

  user       User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  payments   DebtPayment[]
  properties Property[]
}

model DebtPayment {
  id        String   @id @default(cuid())
  debtId    String
  date      DateTime
  amount    Float
  principal Float
  interest  Float
  notes     String?

  debt Debt @relation(fields: [debtId], references: [id], onDelete: Cascade)
}

// ── Property ─────────────────────────────────────────

model Property {
  id       String @id @default(cuid())
  userId   String
  name     String
  currency String @default("EUR")
  debtId   String? // nullable — links to mortgage

  user       User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  debt       Debt?               @relation(fields: [debtId], references: [id], onDelete: SetNull)
  valuations PropertyValuation[]
}

model PropertyValuation {
  id             String   @id @default(cuid())
  propertyId     String
  estimatedValue Float
  date           DateTime @default(now())
  notes          String?

  property Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
}

// ── AI & Usage ───────────────────────────────────────

model AnalysisCache {
  id          String   @id @default(cuid())
  userId      String
  summary     Json
  generatedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ChatMessage {
  id        String   @id @default(cuid())
  userId    String
  role      String   // "user" or "assistant"
  content   String   @db.Text
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ApiUsage {
  id            String   @id @default(cuid())
  userId        String
  endpoint      String   // "parse-statement", "analysis", "chat"
  model         String
  inputTokens   Int
  outputTokens  Int
  estimatedCost Float
  createdAt     DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ── Education ────────────────────────────────────────

model Book {
  id          String @id @default(cuid())
  title       String
  author      String
  coverUrl    String?
  description String? @db.Text
  year        Int?
  category    String  // "investing", "mindset", "budgeting"
  link        String?
}

model FinancialTip {
  id       String  @id @default(cuid())
  content  String  @db.Text
  type     String  // "advice" or "quote"
  author   String? // for quotes
  category String?
}
```

- [ ] **Step 2: Run the migration**

Run:
```bash
cd /var/www/playground
npx prisma migrate dev --name init
```

Expected: Migration succeeds, creates all tables. Output includes "Your database is now in sync with your schema."

- [ ] **Step 3: Verify tables**

Run:
```bash
psql -U wallai_user -d wallai -h localhost -c "\dt"
```

Expected: Lists all tables (User, Account, Session, BankAccount, Transaction, CryptoHolding, Debt, etc.).

- [ ] **Step 4: Commit**

```bash
cd /var/www/playground
git add prisma/
git commit -m "feat: add full Prisma schema with all WallAI tables"
```

---

## Task 4: Prisma Client Singleton

**Files:**
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Create the Prisma client singleton**

Create `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

This prevents multiple Prisma Client instances during Next.js hot reload in development.

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd /var/www/playground
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors related to `prisma.ts`.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/lib/prisma.ts
git commit -m "feat: add Prisma client singleton"
```

---

## Task 5: NextAuth Configuration

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create the NextAuth config**

Create `src/lib/auth.ts`:
```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/wallai",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
```

- [ ] **Step 2: Create the API route handler**

Create directory and file `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Extend NextAuth types**

Create `src/types/next-auth.d.ts`:
```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
```

- [ ] **Step 4: Verify it compiles**

Run:
```bash
cd /var/www/playground
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /var/www/playground
git add src/lib/auth.ts src/app/api/auth/\[...nextauth\]/route.ts src/types/next-auth.d.ts
git commit -m "feat: add NextAuth v5 config with credentials provider"
```

---

## Task 6: Seed Admin User

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Install ts-node for seed script**

Run:
```bash
cd /var/www/playground
npm install ts-node --save-dev
```

- [ ] **Step 2: Create the seed script**

Create `prisma/seed.ts`:
```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("1234", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@wallai.app" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@wallai.app",
      passwordHash,
      primaryCurrency: "EUR",
    },
  });

  console.log("Seeded admin user:", admin.email);

  // Seed financial tips
  const tips = [
    { content: "The best time to start investing was yesterday. The second best time is now.", type: "quote", author: "Chinese Proverb", category: "investing" },
    { content: "Do not save what is left after spending, but spend what is left after saving.", type: "quote", author: "Warren Buffett", category: "saving" },
    { content: "A budget is telling your money where to go instead of wondering where it went.", type: "quote", author: "Dave Ramsey", category: "budgeting" },
    { content: "Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it.", type: "quote", author: "Albert Einstein", category: "investing" },
    { content: "It's not how much money you make, but how much money you keep.", type: "quote", author: "Robert Kiyosaki", category: "saving" },
    { content: "Rule No. 1: Never lose money. Rule No. 2: Never forget Rule No. 1.", type: "quote", author: "Warren Buffett", category: "investing" },
    { content: "Set up automatic transfers to your savings account on payday. You can't spend what you don't see.", type: "advice", author: null, category: "saving" },
    { content: "Keep 3-6 months of expenses in a separate emergency fund. Don't touch it for anything else.", type: "advice", author: null, category: "saving" },
    { content: "Review all your subscriptions monthly. Cancel anything you haven't used in 30 days.", type: "advice", author: null, category: "budgeting" },
    { content: "Pay off your highest-interest debt first (avalanche method) to minimize total interest paid.", type: "advice", author: null, category: "debt" },
    { content: "Never invest money you can't afford to lose. Build your emergency fund first.", type: "advice", author: null, category: "investing" },
    { content: "Track every expense for one month. You'll be surprised where your money goes.", type: "advice", author: null, category: "budgeting" },
    { content: "The 50/30/20 rule: 50% needs, 30% wants, 20% savings. Adjust as needed, but start there.", type: "advice", author: null, category: "budgeting" },
    { content: "Financial freedom is not about being rich. It's about having enough.", type: "quote", author: "Vicki Robin", category: "mindset" },
    { content: "Wealth consists not in having great possessions, but in having few wants.", type: "quote", author: "Epictetus", category: "mindset" },
  ];

  for (const tip of tips) {
    await prisma.financialTip.upsert({
      where: { id: tip.content.slice(0, 20) }, // won't match — forces create
      update: {},
      create: tip,
    });
  }

  console.log(`Seeded ${tips.length} financial tips`);

  // Seed books
  const books = [
    {
      title: "Rich Dad Poor Dad",
      author: "Robert Kiyosaki",
      description: "What the rich teach their kids about money that the poor and middle class do not.",
      year: 1997,
      category: "mindset",
      coverUrl: "https://m.media-amazon.com/images/I/81bsw6fnUiL._AC_UF1000,1000_QL80_.jpg",
      link: "https://www.amazon.com/Rich-Dad-Poor-Teach-Middle/dp/1612680194",
    },
    {
      title: "The Psychology of Money",
      author: "Morgan Housel",
      description: "Timeless lessons on wealth, greed, and happiness. How behavior matters more than knowledge in finance.",
      year: 2020,
      category: "mindset",
      coverUrl: "https://m.media-amazon.com/images/I/81Dky+tD+pL._AC_UF1000,1000_QL80_.jpg",
      link: "https://www.amazon.com/Psychology-Money-Timeless-lessons-happiness/dp/0857197681",
    },
    {
      title: "The Intelligent Investor",
      author: "Benjamin Graham",
      description: "The definitive book on value investing. A practical guide that has inspired investors for decades.",
      year: 1949,
      category: "investing",
      coverUrl: "https://m.media-amazon.com/images/I/91yj3mbz4JL._AC_UF1000,1000_QL80_.jpg",
      link: "https://www.amazon.com/Intelligent-Investor-Definitive-Investing-Essentials/dp/0060555661",
    },
    {
      title: "I Will Teach You to Be Rich",
      author: "Ramit Sethi",
      description: "A practical, no-guilt system for automating your finances. Covers banking, saving, budgeting, and investing.",
      year: 2009,
      category: "budgeting",
      coverUrl: "https://m.media-amazon.com/images/I/71aG0m9XRcL._AC_UF1000,1000_QL80_.jpg",
      link: "https://www.amazon.com/Will-Teach-You-Rich-Second/dp/1523505745",
    },
    {
      title: "The Total Money Makeover",
      author: "Dave Ramsey",
      description: "A proven plan for financial fitness. Baby steps to get out of debt and build wealth.",
      year: 2003,
      category: "budgeting",
      coverUrl: "https://m.media-amazon.com/images/I/71JtMIagpPL._AC_UF1000,1000_QL80_.jpg",
      link: "https://www.amazon.com/Total-Money-Makeover-Classic-Financial/dp/1595555277",
    },
  ];

  for (const book of books) {
    await prisma.book.create({ data: book });
  }

  console.log(`Seeded ${books.length} books`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 3: Add prisma seed command to package.json**

Add to `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

- [ ] **Step 4: Run the seed**

Run:
```bash
cd /var/www/playground
npx prisma db seed
```

Expected: Output shows "Seeded admin user: admin@wallai.app", "Seeded 15 financial tips", "Seeded 5 books".

- [ ] **Step 5: Verify seed data**

Run:
```bash
psql -U wallai_user -d wallai -h localhost -c 'SELECT id, email, name FROM "User";'
psql -U wallai_user -d wallai -h localhost -c 'SELECT COUNT(*) FROM "FinancialTip";'
psql -U wallai_user -d wallai -h localhost -c 'SELECT COUNT(*) FROM "Book";'
```

Expected: 1 admin user, 15 tips, 5 books.

- [ ] **Step 6: Commit**

```bash
cd /var/www/playground
git add prisma/seed.ts package.json package-lock.json
git commit -m "feat: add seed script with admin user, financial tips, and books"
```

---

## Task 7: Shared UI Components

**Files:**
- Create: `src/components/wallai/gradient-bg.tsx`
- Create: `src/components/wallai/glass-card.tsx`
- Create: `src/components/wallai/nav-icons.tsx`
- Create: `src/components/wallai/nav-sidebar.tsx`
- Create: `src/components/wallai/nav-mobile.tsx`

- [ ] **Step 1: Create the gradient background component**

Create `src/components/wallai/gradient-bg.tsx`:
```tsx
export function GradientBg() {
  return (
    <div className="fixed inset-0 bg-[#0A0E1A]">
      <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-emerald-500/15 blur-[160px]" />
      <div className="absolute -right-40 top-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/15 blur-[160px]" />
      <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[160px]" />
      <div className="absolute right-1/4 bottom-1/4 h-[300px] w-[300px] rounded-full bg-cyan-500/10 blur-[120px]" />
    </div>
  );
}
```

- [ ] **Step 2: Create the glass card component**

Create `src/components/wallai/glass-card.tsx`:
```tsx
export function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-xl sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create the nav icons module**

Create `src/components/wallai/nav-icons.tsx`:
```tsx
export const navIcons = {
  dashboard: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  bank: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  ),
  crypto: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
  debts: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  property: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
    </svg>
  ),
  analysis: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  learn: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  settings: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  logout: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  ),
  menu: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
  close: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};
```

- [ ] **Step 4: Create the desktop sidebar**

Create `src/components/wallai/nav-sidebar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navIcons } from "./nav-icons";

const navItems = [
  { icon: navIcons.dashboard, label: "Dashboard", href: "/wallai/dashboard" },
  { icon: navIcons.bank, label: "Bank", href: "/wallai/bank" },
  { icon: navIcons.crypto, label: "Crypto", href: "/wallai/crypto" },
  { icon: navIcons.debts, label: "Debts", href: "/wallai/debts" },
  { icon: navIcons.property, label: "Property", href: "/wallai/property" },
  { icon: navIcons.analysis, label: "Analysis", href: "/wallai/analysis" },
  { icon: navIcons.learn, label: "Learn", href: "/wallai/learn" },
  { icon: navIcons.settings, label: "Settings", href: "/wallai/settings" },
];

export function NavSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-full w-64 flex-col border-r border-white/5 bg-white/[0.03] backdrop-blur-2xl lg:flex">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400">
          <span className="text-sm font-bold text-[#0A0E1A]">W</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-white">
            Wall<span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">AI</span>
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-white/30">Finance</p>
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all ${
                isActive
                  ? "bg-white/10 text-white shadow-lg shadow-white/5"
                  : "text-white/40 hover:bg-white/5 hover:text-white/70"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white/40 transition-all hover:bg-red-500/10 hover:text-red-400"
        >
          {navIcons.logout}
          Sign out
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Create the mobile nav**

Create `src/components/wallai/nav-mobile.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navIcons } from "./nav-icons";

const navItems = [
  { icon: navIcons.dashboard, label: "Dashboard", href: "/wallai/dashboard" },
  { icon: navIcons.bank, label: "Bank", href: "/wallai/bank" },
  { icon: navIcons.crypto, label: "Crypto", href: "/wallai/crypto" },
  { icon: navIcons.debts, label: "Debts", href: "/wallai/debts" },
  { icon: navIcons.property, label: "Property", href: "/wallai/property" },
  { icon: navIcons.analysis, label: "Analysis", href: "/wallai/analysis" },
  { icon: navIcons.learn, label: "Learn", href: "/wallai/learn" },
  { icon: navIcons.settings, label: "Settings", href: "/wallai/settings" },
];

export function NavMobile({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Close menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#0A0E1A]/80 px-4 py-3 backdrop-blur-2xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400">
            <span className="text-xs font-bold text-[#0A0E1A]">W</span>
          </div>
          <h1 className="text-sm font-bold text-white">
            Wall<span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">AI</span>
          </h1>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? navIcons.close : navIcons.menu}
        </button>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <nav
        className={`fixed left-0 right-0 top-[57px] z-25 transform border-b border-white/5 bg-[#0A0E1A]/95 backdrop-blur-2xl transition-all duration-300 ease-in-out lg:hidden ${
          menuOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: 25 }}
      >
        <div className="space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:bg-white/5 hover:text-white/70"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
          <div className="my-2 border-t border-white/5" />
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/40 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            {navIcons.logout}
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/
git commit -m "feat: extract shared WallAI UI components (nav, glass card, gradient bg)"
```

---

## Task 8: WallAI Shared Layout with Auth

**Files:**
- Create: `src/app/wallai/layout.tsx`
- Modify: `src/app/wallai/page.tsx` (login page)
- Modify: `src/app/wallai/dashboard/page.tsx`

- [ ] **Step 1: Create the session provider wrapper**

Create `src/components/wallai/session-provider.tsx`:
```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function WallAISessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 2: Create the authenticated layout shell**

Create `src/components/wallai/app-shell.tsx`:
```tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { GradientBg } from "./gradient-bg";
import { NavSidebar } from "./nav-sidebar";
import { NavMobile } from "./nav-mobile";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Login page doesn't need the shell
  const isLoginPage = pathname === "/wallai";

  useEffect(() => {
    if (status === "unauthenticated" && !isLoginPage) {
      router.replace("/wallai");
    }
  }, [status, isLoginPage, router]);

  // Login page: render children directly (no nav)
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <GradientBg />
        <div className="relative z-10 text-white/50 text-sm">Loading...</div>
      </div>
    );
  }

  // Unauthenticated: handled by useEffect redirect
  if (status === "unauthenticated") return null;

  function handleLogout() {
    signOut({ callbackUrl: "/wallai" });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <GradientBg />
      <NavMobile onLogout={handleLogout} />
      <NavSidebar onLogout={handleLogout} />
      <main className="relative z-10 px-4 pb-8 pt-[73px] sm:px-6 lg:ml-64 lg:p-8">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create the WallAI layout**

Create `src/app/wallai/layout.tsx`:
```tsx
import { WallAISessionProvider } from "@/components/wallai/session-provider";
import { AppShell } from "@/components/wallai/app-shell";

export const metadata = {
  title: "WallAI — Personal Finance",
  description: "Track your complete financial picture with AI-powered insights",
};

export default function WallAILayout({ children }: { children: React.ReactNode }) {
  return (
    <WallAISessionProvider>
      <AppShell>{children}</AppShell>
    </WallAISessionProvider>
  );
}
```

- [ ] **Step 4: Rewrite the login page to use NextAuth**

Replace `src/app/wallai/page.tsx` entirely:
```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { GradientBg } from "@/components/wallai/gradient-bg";

export default function WallAILogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/wallai/dashboard");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <GradientBg />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Wall<span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">AI</span>
          </h1>
          <p className="mt-2 text-sm text-white/50">Personal Finance</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl space-y-5"
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/60">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none backdrop-blur-sm transition-all focus:border-emerald-400/50 focus:bg-white/10 focus:ring-1 focus:ring-emerald-400/30"
              placeholder="admin@wallai.app"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-white/60">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none backdrop-blur-sm transition-all focus:border-emerald-400/50 focus:bg-white/10 focus:ring-1 focus:ring-emerald-400/30"
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/30">
          A playground experiment by Bruno Estreia
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Simplify the dashboard page**

Replace `src/app/wallai/dashboard/page.tsx` — remove all navigation, gradient bg, and auth logic (now handled by layout). Keep only the dashboard content:

The dashboard page should keep all its chart/stat content but remove:
- The `GradientBg` component (in layout now)
- The sidebar and mobile nav (in layout now)
- The `sessionStorage` auth check (NextAuth session now)
- The `<main>` wrapper with `ml-64` and `pt-[73px]` (in layout now)

The page becomes just the dashboard content inside a fragment. Keep all mock data, charts, stat cards, and transactions as-is. Remove the outer `<div className="relative min-h-screen">` wrapper, the gradient bg div, the mobile header, sidebar, and mobile menu. The `GlassCard` component should be imported from `@/components/wallai/glass-card` instead of defined inline.

- [ ] **Step 6: Verify build**

Run:
```bash
cd /var/www/playground
npm run build
```

Expected: Build succeeds with all routes listed.

- [ ] **Step 7: Commit**

```bash
cd /var/www/playground
git add src/app/wallai/ src/components/wallai/session-provider.tsx src/components/wallai/app-shell.tsx
git commit -m "feat: add WallAI shared layout with NextAuth session and responsive nav"
```

---

## Task 9: Placeholder Pages

**Files:**
- Create: `src/app/wallai/bank/page.tsx`
- Create: `src/app/wallai/crypto/page.tsx`
- Create: `src/app/wallai/debts/page.tsx`
- Create: `src/app/wallai/property/page.tsx`
- Create: `src/app/wallai/analysis/page.tsx`
- Create: `src/app/wallai/learn/page.tsx`
- Create: `src/app/wallai/settings/page.tsx`

- [ ] **Step 1: Create all placeholder pages**

Each placeholder follows this pattern — a simple page with a title and coming-soon message. Create all 7 files:

`src/app/wallai/bank/page.tsx`:
```tsx
import { GlassCard } from "@/components/wallai/glass-card";

export default function BankPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Bank Statements</h2>
      <GlassCard>
        <p className="text-sm text-white/50">Upload and manage your bank statements. Coming soon.</p>
      </GlassCard>
    </div>
  );
}
```

`src/app/wallai/crypto/page.tsx`:
```tsx
import { GlassCard } from "@/components/wallai/glass-card";

export default function CryptoPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Crypto Portfolio</h2>
      <GlassCard>
        <p className="text-sm text-white/50">Track your crypto holdings and market performance. Coming soon.</p>
      </GlassCard>
    </div>
  );
}
```

`src/app/wallai/debts/page.tsx`:
```tsx
import { GlassCard } from "@/components/wallai/glass-card";

export default function DebtsPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Debts & Loans</h2>
      <GlassCard>
        <p className="text-sm text-white/50">Manage your mortgage, loans, and credit cards. Coming soon.</p>
      </GlassCard>
    </div>
  );
}
```

`src/app/wallai/property/page.tsx`:
```tsx
import { GlassCard } from "@/components/wallai/glass-card";

export default function PropertyPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Property</h2>
      <GlassCard>
        <p className="text-sm text-white/50">Track property valuations and equity over time. Coming soon.</p>
      </GlassCard>
    </div>
  );
}
```

`src/app/wallai/analysis/page.tsx`:
```tsx
import { GlassCard } from "@/components/wallai/glass-card";

export default function AnalysisPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">AI Analysis</h2>
      <GlassCard>
        <p className="text-sm text-white/50">Get AI-powered insights and chat about your finances. Coming soon.</p>
      </GlassCard>
    </div>
  );
}
```

`src/app/wallai/learn/page.tsx`:
```tsx
import { GlassCard } from "@/components/wallai/glass-card";

export default function LearnPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Learn</h2>
      <GlassCard>
        <p className="text-sm text-white/50">Financial education, book recommendations, and proven strategies. Coming soon.</p>
      </GlassCard>
    </div>
  );
}
```

`src/app/wallai/settings/page.tsx`:
```tsx
import { GlassCard } from "@/components/wallai/glass-card";

export default function SettingsPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Settings</h2>
      <GlassCard>
        <p className="text-sm text-white/50">Profile, currency preferences, API key configuration, and usage tracking. Coming soon.</p>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd /var/www/playground
npm run build
```

Expected: Build succeeds. All routes listed:
```
/wallai
/wallai/dashboard
/wallai/bank
/wallai/crypto
/wallai/debts
/wallai/property
/wallai/analysis
/wallai/learn
/wallai/settings
```

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/app/wallai/bank/ src/app/wallai/crypto/ src/app/wallai/debts/ src/app/wallai/property/ src/app/wallai/analysis/ src/app/wallai/learn/ src/app/wallai/settings/
git commit -m "feat: add placeholder pages for all WallAI routes"
```

---

## Task 10: Build, Restart, and Verify

- [ ] **Step 1: Final build**

Run:
```bash
cd /var/www/playground
npm run build
```

Expected: Clean build with all routes.

- [ ] **Step 2: Restart PM2**

Run:
```bash
pm2 restart playground
```

Expected: Playground process online.

- [ ] **Step 3: Verify login flow**

Open `https://playground.bruno-dev.xyz/wallai` in a browser. Log in with:
- Email: `admin@wallai.app`
- Password: `1234`

Expected: Redirects to `/wallai/dashboard`.

- [ ] **Step 4: Verify navigation**

Click through all nav items in the sidebar. Each page should render its placeholder content with the shared glassmorphism layout.

- [ ] **Step 5: Verify mobile**

Open on a mobile viewport. Hamburger menu should show all 8 nav items + sign out. Each item navigates correctly and closes the menu.

- [ ] **Step 6: Commit any final fixes**

If any fixes were needed during verification, commit them:
```bash
cd /var/www/playground
git add -A
git commit -m "fix: final adjustments from foundation verification"
```
