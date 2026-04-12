# WallAI Bank Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Bank module: bank account management, statement uploads (PDF/CSV/Excel) parsed via Claude, transaction review/import flow, and transaction list with filtering and categorization.

**Architecture:** File uploads go to `/var/www/playground/uploads/{userId}/`. Parsing always goes through Claude — PDF as document content block, CSV/Excel converted to text first. Claude returns a JSON array of transactions which the user reviews and confirms before saving. Bank accounts, statements, and transactions all stored in PostgreSQL via Prisma. All API routes require NextAuth session.

**Tech Stack:** Next.js 16 API routes, Prisma 7 (with @prisma/adapter-pg), NextAuth v5, @anthropic-ai/sdk, papaparse, xlsx (SheetJS), Node.js crypto module (AES-256-GCM)

**Spec:** `docs/superpowers/specs/2026-04-11-wallai-wealth-tracker-design.md`

**Depends on:** Plan 1 (Foundation) — database, auth, layout, placeholder pages

---

## File Structure

```
.env                                                  (MODIFY — add ENCRYPTION_KEY)

uploads/                                              (CREATE — runtime upload dir, gitignored)

src/
  lib/
    encryption.ts                                     (CREATE — AES-256-GCM encrypt/decrypt)
    pricing.ts                                        (CREATE — Anthropic model pricing table)
    anthropic.ts                                      (CREATE — Claude client + usage logging)
    parsers/
      csv-parser.ts                                   (CREATE — CSV → text)
      excel-parser.ts                                 (CREATE — Excel → CSV-like text)
      pdf-parser.ts                                   (CREATE — PDF → base64 for Claude)
      transaction-extractor.ts                        (CREATE — Claude call that extracts transactions from text/PDF)
    statement-parser.ts                               (CREATE — orchestrator: picks parser by file type)
  
  app/
    api/
      wallai/
        api-key/route.ts                              (CREATE — GET check / POST save / DELETE remove)
        bank-accounts/route.ts                        (CREATE — GET list, POST create)
        bank-accounts/[id]/route.ts                   (CREATE — PATCH update, DELETE)
        statements/parse/route.ts                     (CREATE — POST file + accountId → preview)
        statements/confirm/route.ts                   (CREATE — POST transactions + accountId → saved)
        transactions/route.ts                         (CREATE — GET list with filters)
        transactions/[id]/route.ts                    (CREATE — PATCH update, DELETE)
    
    wallai/
      bank/page.tsx                                   (REWRITE — full bank management page)
      settings/page.tsx                               (REWRITE — add API key section)
  
  components/
    wallai/
      bank-account-list.tsx                           (CREATE — list with add/edit/delete)
      bank-account-form.tsx                           (CREATE — modal form for create/edit)
      statement-upload.tsx                            (CREATE — drag-drop file upload)
      statement-review-table.tsx                      (CREATE — editable preview table)
      transaction-list.tsx                            (CREATE — filterable transaction list)
      api-key-card.tsx                                (CREATE — settings card for API key)
      modal.tsx                                       (CREATE — reusable modal component)
```

---

## Task 1: Encryption, Pricing, and API Key Storage

**Files:**
- Modify: `.env`
- Create: `src/lib/encryption.ts`
- Create: `src/lib/pricing.ts`
- Create: `src/app/api/wallai/api-key/route.ts`

- [ ] **Step 1: Add ENCRYPTION_KEY to .env**

Generate a key and add it to `/var/www/playground/.env`:
```bash
echo "ENCRYPTION_KEY=\"$(openssl rand -base64 32)\"" >> /var/www/playground/.env
```

Verify: `grep ENCRYPTION_KEY /var/www/playground/.env` should show a line like `ENCRYPTION_KEY="..."`.

- [ ] **Step 2: Create the encryption module**

Create `src/lib/encryption.ts`:
```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY is not set in environment");
  }
  return scryptSync(secret, "wallai-salt", 32);
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const buffer = Buffer.from(ciphertext, "base64");
  const iv = buffer.subarray(0, 16);
  const authTag = buffer.subarray(16, 32);
  const encrypted = buffer.subarray(32);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
```

- [ ] **Step 3: Create the pricing module**

Create `src/lib/pricing.ts`:
```typescript
// Anthropic model pricing in USD per million tokens.
// Source: https://www.anthropic.com/pricing (update as needed)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model];
  if (!pricing) {
    // Fallback: use Haiku pricing for unknown models
    return ((inputTokens * 0.8) + (outputTokens * 4.0)) / 1_000_000;
  }
  return ((inputTokens * pricing.input) + (outputTokens * pricing.output)) / 1_000_000;
}

export function getAvailableModels(): string[] {
  return Object.keys(PRICING);
}
```

- [ ] **Step 4: Create the API key route**

Create `src/app/api/wallai/api-key/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

// GET — check if API key is configured (never returns the key)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { anthropicKeyEncrypted: true },
  });

  return NextResponse.json({ configured: Boolean(user?.anthropicKeyEncrypted) });
}

// POST — save API key (encrypted)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const apiKey = body?.apiKey;

  if (typeof apiKey !== "string" || apiKey.length < 20) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 400 });
  }

  const encrypted = encrypt(apiKey);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { anthropicKeyEncrypted: encrypted },
  });

  return NextResponse.json({ success: true });
}

// DELETE — remove API key
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { anthropicKeyEncrypted: null },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run:
```bash
cd /var/www/playground
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /var/www/playground
git add src/lib/encryption.ts src/lib/pricing.ts src/app/api/wallai/api-key/
git commit -m "feat: add encryption, pricing, and API key storage endpoint"
```

---

## Task 2: Anthropic Client Wrapper with Usage Logging

**Files:**
- Modify: `package.json`
- Create: `src/lib/anthropic.ts`

- [ ] **Step 1: Install Anthropic SDK**

Run:
```bash
cd /var/www/playground
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Create the Anthropic client wrapper**

Create `src/lib/anthropic.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { calculateCost } from "@/lib/pricing";

export class ApiKeyNotConfiguredError extends Error {
  constructor() {
    super("Anthropic API key not configured. Please add it in Settings.");
    this.name = "ApiKeyNotConfiguredError";
  }
}

export async function getAnthropicClient(userId: string): Promise<Anthropic> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { anthropicKeyEncrypted: true },
  });

  if (!user?.anthropicKeyEncrypted) {
    throw new ApiKeyNotConfiguredError();
  }

  const apiKey = decrypt(user.anthropicKeyEncrypted);
  return new Anthropic({ apiKey });
}

export async function logApiUsage(params: {
  userId: string;
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const estimatedCost = calculateCost(params.model, params.inputTokens, params.outputTokens);
  await prisma.apiUsage.create({
    data: {
      userId: params.userId,
      endpoint: params.endpoint,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCost,
    },
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /var/www/playground
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /var/www/playground
git add src/lib/anthropic.ts package.json package-lock.json
git commit -m "feat: add Anthropic SDK client wrapper with usage logging"
```

---

## Task 3: Statement Parsers

**Files:**
- Modify: `package.json`
- Create: `src/lib/parsers/csv-parser.ts`
- Create: `src/lib/parsers/excel-parser.ts`
- Create: `src/lib/parsers/pdf-parser.ts`
- Create: `src/lib/parsers/transaction-extractor.ts`
- Create: `src/lib/statement-parser.ts`

- [ ] **Step 1: Install parser dependencies**

Run:
```bash
cd /var/www/playground
npm install papaparse xlsx
npm install @types/papaparse --save-dev
```

- [ ] **Step 2: Create the CSV parser**

Create `src/lib/parsers/csv-parser.ts`:
```typescript
import Papa from "papaparse";

/**
 * Parse a CSV file buffer and return the raw text representation.
 * Tries comma delimiter first, falls back to semicolon (common in European banks).
 */
export function parseCsvToText(buffer: Buffer): string {
  const text = buffer.toString("utf-8");

  // Try comma first
  const commaResult = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const semicolonResult = Papa.parse<string[]>(text, { skipEmptyLines: true, delimiter: ";" });

  // Pick whichever produced more columns on average
  const commaAvg = avgColumns(commaResult.data);
  const semicolonAvg = avgColumns(semicolonResult.data);

  const rows = semicolonAvg > commaAvg ? semicolonResult.data : commaResult.data;

  // Reformat as tab-separated text — easier for Claude to read
  return rows.map((row) => row.join("\t")).join("\n");
}

function avgColumns(rows: string[][]): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, row) => sum + row.length, 0);
  return total / rows.length;
}
```

- [ ] **Step 3: Create the Excel parser**

Create `src/lib/parsers/excel-parser.ts`:
```typescript
import * as XLSX from "xlsx";

/**
 * Parse an Excel file buffer and return the first sheet as tab-separated text.
 */
export function parseExcelToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return "";
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });
  return rows.map((row) => (Array.isArray(row) ? row.join("\t") : "")).join("\n");
}
```

- [ ] **Step 4: Create the PDF parser**

Create `src/lib/parsers/pdf-parser.ts`:
```typescript
/**
 * Convert a PDF file buffer to a base64 string for Claude's document content block.
 */
export function pdfBufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}
```

- [ ] **Step 5: Create the transaction extractor (Claude call)**

Create `src/lib/parsers/transaction-extractor.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, logApiUsage } from "@/lib/anthropic";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4096;

const EXTRACT_PROMPT = `Extract all transactions from the provided bank statement data.

Return ONLY a JSON array, no markdown fences, no explanations, no other text.

Format:
[
  {
    "date": "YYYY-MM-DD",
    "description": "transaction description",
    "amount": 123.45,
    "currency": "EUR"
  }
]

Rules:
- Positive amounts = money IN (income/credit/deposit)
- Negative amounts = money OUT (expense/debit/withdrawal)
- Dates must be in YYYY-MM-DD format — convert from any other format
- If currency is not explicit, use "EUR"
- Skip balance-only rows; only return actual transactions
- Keep descriptions as they appear on the statement
- Return [] if no transactions are found`;

export type ParsedTransaction = {
  date: string;
  description: string;
  amount: number;
  currency: string;
};

export async function extractTransactionsFromText(
  userId: string,
  text: string
): Promise<ParsedTransaction[]> {
  const client = await getAnthropicClient(userId);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: `${EXTRACT_PROMPT}\n\n---\n\nBANK DATA:\n\n${text}`,
      },
    ],
  });

  await logApiUsage({
    userId,
    endpoint: "parse-statement",
    model: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return parseClaudeResponse(response.content);
}

export async function extractTransactionsFromPdf(
  userId: string,
  pdfBase64: string
): Promise<ParsedTransaction[]> {
  const client = await getAnthropicClient(userId);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: EXTRACT_PROMPT,
          },
        ],
      },
    ],
  });

  await logApiUsage({
    userId,
    endpoint: "parse-statement",
    model: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return parseClaudeResponse(response.content);
}

function parseClaudeResponse(content: Anthropic.Messages.ContentBlock[]): ParsedTransaction[] {
  const textBlock = content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");
  if (!textBlock) return [];

  let text = textBlock.text.trim();

  // Strip markdown fences if Claude added them despite the prompt
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidTransaction);
  } catch {
    return [];
  }
}

function isValidTransaction(t: unknown): t is ParsedTransaction {
  if (typeof t !== "object" || t === null) return false;
  const obj = t as Record<string, unknown>;
  return (
    typeof obj.date === "string" &&
    typeof obj.description === "string" &&
    typeof obj.amount === "number" &&
    typeof obj.currency === "string"
  );
}
```

- [ ] **Step 6: Create the orchestrator**

Create `src/lib/statement-parser.ts`:
```typescript
import { parseCsvToText } from "@/lib/parsers/csv-parser";
import { parseExcelToText } from "@/lib/parsers/excel-parser";
import { pdfBufferToBase64 } from "@/lib/parsers/pdf-parser";
import {
  extractTransactionsFromText,
  extractTransactionsFromPdf,
  type ParsedTransaction,
} from "@/lib/parsers/transaction-extractor";

export type FileType = "pdf" | "csv" | "excel";

export function detectFileType(filename: string, mimeType: string): FileType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (lower.endsWith(".csv") || mimeType === "text/csv") return "csv";
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return "excel";
  }
  return null;
}

export async function parseStatement(
  userId: string,
  buffer: Buffer,
  fileType: FileType
): Promise<ParsedTransaction[]> {
  if (fileType === "pdf") {
    const base64 = pdfBufferToBase64(buffer);
    return extractTransactionsFromPdf(userId, base64);
  }

  const text = fileType === "csv" ? parseCsvToText(buffer) : parseExcelToText(buffer);
  if (!text.trim()) return [];

  return extractTransactionsFromText(userId, text);
}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run:
```bash
cd /var/www/playground
npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
cd /var/www/playground
git add src/lib/parsers/ src/lib/statement-parser.ts package.json package-lock.json
git commit -m "feat: add statement parsers (CSV, Excel, PDF) with Claude extraction"
```

---

## Task 4: Bank Accounts API Routes

**Files:**
- Create: `src/app/api/wallai/bank-accounts/route.ts`
- Create: `src/app/api/wallai/bank-accounts/[id]/route.ts`

- [ ] **Step 1: Create the list + create route**

Create `src/app/api/wallai/bank-accounts/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.bankAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const currency = typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : "EUR";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (currency.length !== 3) {
    return NextResponse.json({ error: "Currency must be 3 letters" }, { status: 400 });
  }

  const account = await prisma.bankAccount.create({
    data: {
      userId: session.user.id,
      name,
      currency,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
```

- [ ] **Step 2: Create the update + delete route**

Create `src/app/api/wallai/bank-accounts/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: { name?: string; currency?: string } = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.currency === "string" && body.currency.trim().length === 3) {
    data.currency = body.currency.trim().toUpperCase();
  }

  const account = await prisma.bankAccount.update({ where: { id }, data });
  return NextResponse.json({ account });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.bankAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /var/www/playground
npm run build
```

Expected: Build succeeds with the two new API routes listed.

- [ ] **Step 4: Commit**

```bash
cd /var/www/playground
git add src/app/api/wallai/bank-accounts/
git commit -m "feat: add bank accounts API routes (list, create, update, delete)"
```

---

## Task 5: Statement Upload API Routes

**Files:**
- Modify: `.gitignore`
- Create: `src/app/api/wallai/statements/parse/route.ts`
- Create: `src/app/api/wallai/statements/confirm/route.ts`

- [ ] **Step 1: Ensure uploads dir is gitignored**

Append to `/var/www/playground/.gitignore`:
```
# Upload directory
uploads/
```

Create the uploads directory:
```bash
mkdir -p /var/www/playground/uploads
chmod 755 /var/www/playground/uploads
```

- [ ] **Step 2: Create the parse route**

Create `src/app/api/wallai/statements/parse/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectFileType, parseStatement } from "@/lib/statement-parser";
import { ApiKeyNotConfiguredError } from "@/lib/anthropic";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const bankAccountId = formData.get("bankAccountId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (typeof bankAccountId !== "string" || !bankAccountId) {
    return NextResponse.json({ error: "bankAccountId is required" }, { status: 400 });
  }

  // Verify the bank account belongs to this user
  const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!account || account.userId !== session.user.id) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  }

  const fileType = detectFileType(file.name, file.type);
  if (!fileType) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, CSV, or Excel." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Save the file to uploads/{userId}/
  const userDir = join(UPLOADS_DIR, session.user.id);
  await mkdir(userDir, { recursive: true });
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = join(userDir, `${timestamp}-${safeName}`);
  await writeFile(storagePath, buffer);

  // Parse via Claude
  try {
    const transactions = await parseStatement(session.user.id, buffer, fileType);
    return NextResponse.json({
      transactions,
      fileName: file.name,
      fileType,
      storagePath,
    });
  } catch (error) {
    if (error instanceof ApiKeyNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Statement parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse statement. Check your API key and try again." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create the confirm route**

Create `src/app/api/wallai/statements/confirm/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ConfirmTransaction = {
  date: string;
  description: string;
  amount: number;
  currency: string;
  category?: string | null;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const bankAccountId = body?.bankAccountId;
  const fileName = body?.fileName;
  const fileType = body?.fileType;
  const storagePath = body?.storagePath;
  const transactions = body?.transactions;

  if (typeof bankAccountId !== "string" || !bankAccountId) {
    return NextResponse.json({ error: "bankAccountId is required" }, { status: 400 });
  }
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: "At least one transaction is required" }, { status: 400 });
  }

  const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!account || account.userId !== session.user.id) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  }

  // Create the statement record
  const statement = await prisma.bankStatement.create({
    data: {
      userId: session.user.id,
      bankAccountId,
      fileName: typeof fileName === "string" ? fileName : "uploaded",
      fileType: typeof fileType === "string" ? fileType : "unknown",
      rawStoragePath: typeof storagePath === "string" ? storagePath : "",
    },
  });

  // Create transactions
  const data = (transactions as ConfirmTransaction[]).map((t) => ({
    userId: session.user.id!,
    bankAccountId,
    statementId: statement.id,
    date: new Date(t.date),
    description: t.description,
    amount: t.amount,
    currency: t.currency || account.currency,
    category: t.category || null,
  }));

  const result = await prisma.transaction.createMany({ data });

  return NextResponse.json({
    statementId: statement.id,
    imported: result.count,
  });
}
```

- [ ] **Step 4: Verify build**

Run:
```bash
cd /var/www/playground
npm run build 2>&1 | tail -20
```

Expected: Build succeeds. Routes listed include `/api/wallai/statements/parse` and `/api/wallai/statements/confirm` (both dynamic).

- [ ] **Step 5: Commit**

```bash
cd /var/www/playground
git add .gitignore src/app/api/wallai/statements/
git commit -m "feat: add statement parse and confirm API routes"
```

---

## Task 6: Transactions API Routes

**Files:**
- Create: `src/app/api/wallai/transactions/route.ts`
- Create: `src/app/api/wallai/transactions/[id]/route.ts`

- [ ] **Step 1: Create the list route**

Create `src/app/api/wallai/transactions/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const bankAccountId = url.searchParams.get("bankAccountId");
  const category = url.searchParams.get("category");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);

  const where: Prisma.TransactionWhereInput = { userId: session.user.id };
  if (bankAccountId) where.bankAccountId = bankAccountId;
  if (category) where.category = category;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
    take: limit,
    include: {
      bankAccount: { select: { id: true, name: true, currency: true } },
    },
  });

  return NextResponse.json({ transactions });
}
```

- [ ] **Step 2: Create the update + delete route**

Create `src/app/api/wallai/transactions/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    category?: string | null;
    description?: string;
    amount?: number;
    notes?: string | null;
  } = {};

  if (typeof body?.category === "string") data.category = body.category || null;
  if (body?.category === null) data.category = null;
  if (typeof body?.description === "string" && body.description.trim()) {
    data.description = body.description.trim();
  }
  if (typeof body?.amount === "number" && Number.isFinite(body.amount)) {
    data.amount = body.amount;
  }
  if (typeof body?.notes === "string") data.notes = body.notes || null;
  if (body?.notes === null) data.notes = null;

  const updated = await prisma.transaction.update({ where: { id }, data });
  return NextResponse.json({ transaction: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /var/www/playground
npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /var/www/playground
git add src/app/api/wallai/transactions/
git commit -m "feat: add transactions API routes (list with filters, update, delete)"
```

---

## Task 7: Shared UI Components (Modal, API Key Card)

**Files:**
- Create: `src/components/wallai/modal.tsx`
- Create: `src/components/wallai/api-key-card.tsx`

- [ ] **Step 1: Create the reusable modal component**

Create `src/components/wallai/modal.tsx`:
```tsx
"use client";

import { useEffect } from "react";

export function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0E1A]/95 p-6 shadow-2xl backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the API key card**

Create `src/components/wallai/api-key-card.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "./glass-card";

export function ApiKeyCard() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/wallai/api-key")
      .then((res) => res.json())
      .then((data) => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/wallai/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });

    if (res.ok) {
      setConfigured(true);
      setApiKey("");
      setMessage({ type: "success", text: "API key saved securely." });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Failed to save API key." });
    }
    setSaving(false);
  }

  async function handleRemove() {
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/wallai/api-key", { method: "DELETE" });

    if (res.ok) {
      setConfigured(false);
      setMessage({ type: "success", text: "API key removed." });
    } else {
      setMessage({ type: "error", text: "Failed to remove API key." });
    }
    setSaving(false);
  }

  return (
    <GlassCard>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Anthropic API Key</h3>
          <p className="mt-1 text-xs text-white/40">
            Required for parsing bank statements and AI analysis. Get one at console.anthropic.com.
          </p>
        </div>
        {configured !== null && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs ${
              configured ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40"
            }`}
          >
            {configured ? "Configured" : "Not set"}
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={configured ? "Enter new key to replace existing" : "sk-ant-..."}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-emerald-400/50 focus:bg-white/10 focus:ring-1 focus:ring-emerald-400/30"
          autoComplete="off"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || apiKey.length < 20}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 disabled:opacity-40"
          >
            {saving ? "Saving..." : configured ? "Replace key" : "Save key"}
          </button>
          {configured && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </div>
      </form>

      {message && (
        <p
          className={`mt-3 text-xs ${
            message.type === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/modal.tsx src/components/wallai/api-key-card.tsx
git commit -m "feat: add modal and API key card components"
```

---

## Task 8: Bank Account Components

**Files:**
- Create: `src/components/wallai/bank-account-form.tsx`
- Create: `src/components/wallai/bank-account-list.tsx`

- [ ] **Step 1: Create the bank account form**

Create `src/components/wallai/bank-account-form.tsx`:
```tsx
"use client";

import { useState } from "react";

export type BankAccountFormValue = {
  id?: string;
  name: string;
  currency: string;
};

export function BankAccountForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: BankAccountFormValue;
  onSubmit: (value: BankAccountFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "EUR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (currency.length !== 3) {
      setError("Currency must be 3 letters (e.g. EUR)");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSubmit({ id: initial?.id, name: name.trim(), currency: currency.toUpperCase() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/60">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. CGD Main Account"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/60">Currency</label>
        <input
          type="text"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          maxLength={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create the bank account list**

Create `src/components/wallai/bank-account-list.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "./glass-card";
import { Modal } from "./modal";
import { BankAccountForm, type BankAccountFormValue } from "./bank-account-form";

export type BankAccount = {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
};

export function BankAccountList({
  onSelect,
  selectedId,
}: {
  onSelect?: (account: BankAccount) => void;
  selectedId?: string | null;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  async function loadAccounts() {
    setLoading(true);
    const res = await fetch("/api/wallai/bank-accounts");
    const data = await res.json();
    setAccounts(data.accounts || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function handleSubmit(value: BankAccountFormValue) {
    const url = value.id
      ? `/api/wallai/bank-accounts/${value.id}`
      : "/api/wallai/bank-accounts";
    const method = value.id ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value.name, currency: value.currency }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to save");
    }

    setModalOpen(false);
    setEditing(null);
    await loadAccounts();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this account and all its transactions?")) return;
    await fetch(`/api/wallai/bank-accounts/${id}`, { method: "DELETE" });
    await loadAccounts();
  }

  return (
    <>
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Bank Accounts</h3>
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110"
          >
            + Add
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-white/40">Loading...</p>
        ) : accounts.length === 0 ? (
          <p className="text-xs text-white/40">No accounts yet. Add one to start tracking.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const isSelected = selectedId === account.id;
              return (
                <div
                  key={account.id}
                  className={`group flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors ${
                    isSelected
                      ? "border-emerald-400/40 bg-emerald-500/10"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                  }`}
                >
                  <button
                    onClick={() => onSelect?.(account)}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-white/90">{account.name}</p>
                    <p className="text-[10px] text-white/30">{account.currency}</p>
                  </button>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(account);
                        setModalOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
                      aria-label="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(account.id);
                      }}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit Bank Account" : "New Bank Account"}
      >
        <BankAccountForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/bank-account-form.tsx src/components/wallai/bank-account-list.tsx
git commit -m "feat: add bank account list and form components"
```

---

## Task 9: Statement Upload & Review Components

**Files:**
- Create: `src/components/wallai/statement-upload.tsx`
- Create: `src/components/wallai/statement-review-table.tsx`

- [ ] **Step 1: Create the review table**

Create `src/components/wallai/statement-review-table.tsx`:
```tsx
"use client";

import { useState } from "react";

export type ReviewTransaction = {
  date: string;
  description: string;
  amount: number;
  currency: string;
  category?: string | null;
};

export function StatementReviewTable({
  transactions,
  onConfirm,
  onCancel,
  saving,
}: {
  transactions: ReviewTransaction[];
  onConfirm: (transactions: ReviewTransaction[]) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [rows, setRows] = useState<ReviewTransaction[]>(transactions);

  function updateRow(index: number, patch: Partial<ReviewTransaction>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/70">
          Found <span className="font-semibold text-white">{rows.length}</span> transactions. Review and edit before importing.
        </p>
      </div>

      <div className="max-h-[500px] overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0A0E1A]/95 backdrop-blur-lg">
            <tr className="border-b border-white/10">
              <th className="px-3 py-2 text-left font-medium text-white/50">Date</th>
              <th className="px-3 py-2 text-left font-medium text-white/50">Description</th>
              <th className="px-3 py-2 text-right font-medium text-white/50">Amount</th>
              <th className="px-3 py-2 text-center font-medium text-white/50"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(i, { date: e.target.value })}
                    className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-white outline-none focus:border-white/20 focus:bg-white/5"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
                    className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-white outline-none focus:border-white/20 focus:bg-white/5"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => updateRow(i, { amount: parseFloat(e.target.value) || 0 })}
                    className={`w-24 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right outline-none focus:border-white/20 focus:bg-white/5 ${
                      row.amount >= 0 ? "text-emerald-400" : "text-white"
                    }`}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => removeRow(i)}
                    className="rounded p-1 text-white/30 hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Remove"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(rows)}
          disabled={saving || rows.length === 0}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-40"
        >
          {saving ? "Importing..." : `Import ${rows.length} transactions`}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the upload component**

Create `src/components/wallai/statement-upload.tsx`:
```tsx
"use client";

import { useState } from "react";
import { GlassCard } from "./glass-card";
import { Modal } from "./modal";
import { StatementReviewTable, type ReviewTransaction } from "./statement-review-table";

type ParseResult = {
  transactions: ReviewTransaction[];
  fileName: string;
  fileType: string;
  storagePath: string;
};

export function StatementUpload({
  bankAccountId,
  bankAccountName,
  onImported,
}: {
  bankAccountId: string | null;
  bankAccountName: string | null;
  onImported: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleFile(file: File) {
    if (!bankAccountId) {
      setError("Select a bank account first");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bankAccountId", bankAccountId);

    try {
      const res = await fetch("/api/wallai/statements/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse statement");
      }

      if (!data.transactions || data.transactions.length === 0) {
        setError("No transactions found in the file");
        setUploading(false);
        return;
      }

      setParseResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }

    setUploading(false);
  }

  async function handleConfirm(transactions: ReviewTransaction[]) {
    if (!parseResult || !bankAccountId) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/wallai/statements/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId,
          fileName: parseResult.fileName,
          fileType: parseResult.fileType,
          storagePath: parseResult.storagePath,
          transactions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import transactions");
      }

      setParseResult(null);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setSaving(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <>
      <GlassCard>
        <h3 className="mb-3 text-sm font-semibold text-white">Upload Statement</h3>

        {!bankAccountId ? (
          <p className="text-xs text-white/40">Select a bank account above to upload statements.</p>
        ) : (
          <>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragActive
                  ? "border-emerald-400/50 bg-emerald-500/5"
                  : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
              }`}
            >
              <input
                type="file"
                accept=".pdf,.csv,.xlsx,.xls"
                onChange={onFileInputChange}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                <p className="text-sm text-white/60">Parsing with Claude...</p>
              ) : (
                <>
                  <svg className="mb-2 h-8 w-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-xs text-white/60">
                    Drop a file for <span className="font-medium text-white/80">{bankAccountName}</span>
                  </p>
                  <p className="mt-1 text-[10px] text-white/30">PDF, CSV, or Excel</p>
                </>
              )}
            </label>

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          </>
        )}
      </GlassCard>

      <Modal
        isOpen={parseResult !== null}
        onClose={() => {
          if (!saving) setParseResult(null);
        }}
        title="Review Transactions"
      >
        {parseResult && (
          <StatementReviewTable
            transactions={parseResult.transactions}
            onConfirm={handleConfirm}
            onCancel={() => setParseResult(null)}
            saving={saving}
          />
        )}
      </Modal>
    </>
  );
}
```

Note: The review modal uses the Modal component but needs a wider max-width. Update `Modal` in `src/components/wallai/modal.tsx` to accept an optional `size` prop:

Change the modal's main container line from:
```tsx
<div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0E1A]/95 p-6 shadow-2xl backdrop-blur-2xl">
```

To:
```tsx
<div className={`relative z-10 w-full ${size === "lg" ? "max-w-3xl" : "max-w-md"} rounded-2xl border border-white/10 bg-[#0A0E1A]/95 p-6 shadow-2xl backdrop-blur-2xl`}>
```

And add `size` to the props:
```tsx
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
```

Then use `<Modal ... size="lg">` in the statement-upload component for the review modal.

- [ ] **Step 3: Update the statement-upload component to use size="lg"**

In `src/components/wallai/statement-upload.tsx`, change the review Modal to:
```tsx
<Modal
  isOpen={parseResult !== null}
  onClose={() => {
    if (!saving) setParseResult(null);
  }}
  title="Review Transactions"
  size="lg"
>
```

- [ ] **Step 4: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/statement-upload.tsx src/components/wallai/statement-review-table.tsx src/components/wallai/modal.tsx
git commit -m "feat: add statement upload component with review modal"
```

---

## Task 10: Transaction List Component

**Files:**
- Create: `src/components/wallai/transaction-list.tsx`

- [ ] **Step 1: Create the transaction list component**

Create `src/components/wallai/transaction-list.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { GlassCard } from "./glass-card";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  bankAccount?: { id: string; name: string; currency: string };
};

const COMMON_CATEGORIES = [
  "Income",
  "Housing",
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Transfer",
  "Other",
];

export function TransactionList({
  bankAccountId,
  refreshToken,
}: {
  bankAccountId: string | null;
  refreshToken: number;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (bankAccountId) params.set("bankAccountId", bankAccountId);
    if (categoryFilter) params.set("category", categoryFilter);

    const res = await fetch(`/api/wallai/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    setLoading(false);
  }, [bankAccountId, categoryFilter]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  async function updateCategory(id: string, category: string) {
    await fetch(`/api/wallai/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category || null }),
    });
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, category: category || null } : t))
    );
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/wallai/transactions/${id}`, { method: "DELETE" });
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <GlassCard>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-white">Transactions</h3>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 outline-none focus:border-white/20"
        >
          <option value="">All categories</option>
          {COMMON_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-xs text-white/40">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-xs text-white/40">
          {bankAccountId ? "No transactions for this account yet." : "Select an account to view transactions."}
        </p>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="group flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 hover:bg-white/5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-medium text-white/90 sm:text-sm">
                    {tx.description}
                  </p>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/30">
                  <span>{new Date(tx.date).toLocaleDateString()}</span>
                  {tx.bankAccount && <span>• {tx.bankAccount.name}</span>}
                </div>
              </div>

              <select
                value={tx.category || ""}
                onChange={(e) => updateCategory(tx.id, e.target.value)}
                className="w-24 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-white/20 sm:w-28"
              >
                <option value="">Uncategorized</option>
                {COMMON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <div className="text-right">
                <p
                  className={`text-xs font-semibold sm:text-sm ${
                    tx.amount >= 0 ? "text-emerald-400" : "text-white"
                  }`}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount.toFixed(2)} {tx.currency}
                </p>
              </div>

              <button
                onClick={() => deleteTransaction(tx.id)}
                className="rounded p-1 text-white/20 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                aria-label="Delete"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/transaction-list.tsx
git commit -m "feat: add transaction list component with filtering and categorization"
```

---

## Task 11: Bank Page & Settings Page Integration

**Files:**
- Rewrite: `src/app/wallai/bank/page.tsx`
- Rewrite: `src/app/wallai/settings/page.tsx`

- [ ] **Step 1: Rewrite the bank page**

Replace `src/app/wallai/bank/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { BankAccountList, type BankAccount } from "@/components/wallai/bank-account-list";
import { StatementUpload } from "@/components/wallai/statement-upload";
import { TransactionList } from "@/components/wallai/transaction-list";

export default function BankPage() {
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  function handleImported() {
    setRefreshToken((t) => t + 1);
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Bank Statements</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <BankAccountList
            onSelect={setSelectedAccount}
            selectedId={selectedAccount?.id ?? null}
          />
          <StatementUpload
            bankAccountId={selectedAccount?.id ?? null}
            bankAccountName={selectedAccount?.name ?? null}
            onImported={handleImported}
          />
        </div>
        <div className="lg:col-span-2">
          <TransactionList
            bankAccountId={selectedAccount?.id ?? null}
            refreshToken={refreshToken}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the settings page with API key section**

Replace `src/app/wallai/settings/page.tsx`:
```tsx
import { ApiKeyCard } from "@/components/wallai/api-key-card";

export default function SettingsPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Settings</h2>
      <div className="grid grid-cols-1 gap-4 lg:max-w-2xl">
        <ApiKeyCard />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /var/www/playground
npm run build 2>&1 | tail -30
```

Expected: Build succeeds, all new routes listed.

- [ ] **Step 4: Commit**

```bash
cd /var/www/playground
git add src/app/wallai/bank/page.tsx src/app/wallai/settings/page.tsx
git commit -m "feat: integrate bank page and add API key section to settings"
```

---

## Task 12: Deploy and Verify

- [ ] **Step 1: Final build**

```bash
cd /var/www/playground
npm run build
```

Expected: Clean build with all new API routes and pages. Verify these routes appear:
- `/api/wallai/api-key`
- `/api/wallai/bank-accounts`
- `/api/wallai/bank-accounts/[id]`
- `/api/wallai/statements/parse`
- `/api/wallai/statements/confirm`
- `/api/wallai/transactions`
- `/api/wallai/transactions/[id]`

- [ ] **Step 2: Restart PM2**

```bash
pm2 restart playground --update-env
```

Expected: Process online.

- [ ] **Step 3: Verify API endpoints respond correctly**

Without a session, each protected endpoint should return 401:
```bash
curl -sI https://playground.bruno-dev.xyz/api/wallai/bank-accounts | head -3
curl -sI https://playground.bruno-dev.xyz/api/wallai/transactions | head -3
curl -sI https://playground.bruno-dev.xyz/api/wallai/api-key | head -3
```

Expected: `HTTP/2 401` (or 200 with `{"error":"Unauthorized"}` body, depending on how Next.js handles it).

- [ ] **Step 4: Manual verification**

Open `https://playground.bruno-dev.xyz/wallai` in a browser. Log in as `admin@wallai.app` / `1234`.

Test flow:
1. Go to **Settings** → add your Anthropic API key → status shows "Configured"
2. Go to **Bank** → click "+ Add" → create a bank account (e.g. "Test CGD", "EUR")
3. Select the account
4. Upload a real bank statement (PDF/CSV/Excel) via the drag-drop zone
5. Wait for Claude to parse it
6. Review the transactions in the modal
7. Click "Import"
8. See the transactions appear in the transaction list
9. Change a category on a transaction
10. Filter by category
11. Delete a transaction

If any step fails:
- Check `pm2 logs playground` for errors
- Verify the Anthropic API key is valid
- Check the database: `PGPASSWORD=wallai_dev_2026 psql -U wallai_user -d wallai -h localhost -c 'SELECT COUNT(*) FROM "Transaction";'`

- [ ] **Step 5: Commit any fixes from verification**

```bash
cd /var/www/playground
git add -A
git commit -m "fix: final adjustments from bank module verification"
```
