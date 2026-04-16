# Bank Institution Grouping — Design

**Date:** 2026-04-16
**Status:** Approved (brainstorming)
**Scope:** Bank page only. No changes to dashboard, analysis, or statement parsing.

## Problem

`BankAccount` is a flat list. A single real-world bank (e.g., BPI) can produce 3+ subaccounts (current, savings, joint), and they all show as siblings in the bank-account list with no visual relationship. The user wants to collapse them under a single "BPI" parent, expand to see subaccounts, and optionally view aggregated transactions across the whole institution.

## Goals

- Group `BankAccount` rows under a parent **Institution** (e.g., BPI, Revolut).
- On the bank page, render institutions as expandable groups with their subaccounts indented inside.
- Allow two selection modes:
  - **Aggregate**: tap an institution row → transactions from all its subaccounts appear, each tagged with the subaccount name.
  - **Single**: tap a subaccount → only that subaccount's transactions (current behavior).
- Provide an "Ungrouped" section so accounts without an institution still appear.

## Non-Goals

- Per-institution color, logo, or emoji.
- Bulk-reassign UI for moving multiple accounts to a different institution.
- Auto-detection of institution from uploaded statement contents.
- Statement upload at the institution level (still targets one subaccount).
- Changes to the dashboard or analysis pages.

## Data Model (Prisma)

New model:

```prisma
model Institution {
  id        String   @id @default(cuid())
  userId    String
  name      String
  createdAt DateTime @default(now())

  user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  accounts BankAccount[]

  @@unique([userId, name])
}
```

Modify `BankAccount`:

```prisma
model BankAccount {
  // ...existing fields
  institutionId String?
  institution   Institution? @relation(fields: [institutionId], references: [id], onDelete: SetNull)
}
```

**Migration behavior:** existing accounts get `institutionId = null` and appear in the "Ungrouped" section until the user assigns them.

## API

All routes scoped by the authenticated user (mirroring existing bank routes).

- `GET  /api/wallai/institutions` → `{ institutions: { id, name, createdAt }[] }`
- `POST /api/wallai/institutions` → body `{ name }`; returns the created row. 409 on duplicate name.
- `PATCH /api/wallai/institutions/[id]` → body `{ name }`. 409 on duplicate.
- `DELETE /api/wallai/institutions/[id]` → removes the institution; per Prisma `onDelete: SetNull`, owned accounts have `institutionId` cleared and move to "Ungrouped". Transactions are untouched.
- `GET  /api/wallai/bank-accounts` → already returns the row; serializer must include `institutionId`.
- `PATCH /api/wallai/bank-accounts/[id]` → accept `institutionId: string | null`. Validate that the institution belongs to the same user.
- `GET  /api/wallai/transactions?institutionId=...` → new alternative to `bankAccountId`. Returns transactions whose `bankAccount.institutionId` matches; each row includes `bankAccount: { id, name }` so the UI can show a subaccount badge. Existing `bankAccountId` query continues to work unchanged.

If both `bankAccountId` and `institutionId` are passed, `bankAccountId` wins (more specific).

## UI

### `bank-account-list.tsx`

- On mount, fetch institutions and accounts in parallel.
- Build groups: `[ { institution, accounts[] }, ..., { institution: null, accounts: ungrouped[] } ]`.
- Render each group as a collapsible block:
  - **Header row:** chevron (▸/▾) + institution name + total balance summed across its accounts. Tapping the body of the row selects the institution (aggregate mode). Tapping the chevron toggles expand/collapse only.
  - **Subaccount rows:** rendered when expanded; same look as today's account rows, indented ~12px on the left. Tapping selects the single account.
  - **Ungrouped group:** no chevron; subaccounts always visible. (Skip rendering the section entirely if empty.)
- Selected highlight: institution row in aggregate mode, subaccount row in single mode.
- "+ Add" button still creates a `BankAccount` via the existing form.
- A small "Manage institutions" link at the bottom of the list opens a lightweight modal listing institutions with rename + delete actions, plus an inline "+ New" input. (Avoids burying it in settings.)

### `bank-account-form.tsx`

- Add an **Institution** dropdown above the existing fields. Options: each user institution, plus "— None —" and "+ New institution…" (opens a one-field nested modal that creates and immediately selects the new institution).

### `bank/page.tsx`

- Replace `selectedAccount: BankAccount | null` with `selected: { kind: "account" | "institution"; id: string } | null`.
- Pass either `bankAccountId` or `institutionId` to `TransactionList` and `StatementUpload`.
- `StatementUpload` only shows the upload form when `selected.kind === "account"`. In aggregate mode it shows: "Pick a subaccount to upload a statement."

### `transaction-list.tsx`

- Accept either `bankAccountId` or `institutionId` prop. Pass whichever is set to the API.
- When in institution mode, render a small subaccount badge on each transaction row (e.g., "BPI · Joint" — using the embedded `bankAccount.name`).

## State Persistence

- Expand/collapse state is component-local (`useState`), not persisted across reloads. Default: all institutions expanded on first load. (Simple; revisit if it gets noisy.)

## Mobile

- Chevron tap target ≥44px (use a wrapping button with padding, even though the icon is small).
- Subaccount indent kept to ~12px to avoid right-edge truncation at 375px.
- Institution row body remains full-width tappable for aggregate mode.
- "Manage institutions" modal uses the existing `Modal` component (already mobile-tested).

## Testing

- Manual verification at 375px width (mobile-first rule).
- Verify on the live deploy:
  - Create "BPI" institution; assign 3 existing accounts to it.
  - Collapse/expand toggles independently per institution.
  - Tap BPI row → transaction list shows merged transactions with subaccount badges.
  - Tap a subaccount → list filters to that subaccount only.
  - Statement upload disabled in aggregate mode with helper text.
  - Delete BPI → its accounts move to "Ungrouped" (institutionId set to null), no transactions lost.
  - Rename BPI → header updates after refresh.

## Out of Scope (Future)

- Color/logo per institution.
- Drag-and-drop to reassign accounts.
- Statement parser inferring institution from PDF.
- Aggregating across institutions (e.g., "All accounts" view).
