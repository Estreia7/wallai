# WallAI Settings Page — Design Spec

**Date:** 2026-04-12
**Status:** Approved

---

## Overview

Full settings page with 4 sections: Profile, Currency, API Key (existing), and API Usage tracking with daily cost chart and per-day call breakdown.

## Sections

### 1. Profile

- Display current name and email (email is read-only, shown as plain text)
- Editable name field with save button
- Password change: current password + new password + confirm new password, with save button
- Both forms in the same GlassCard, visually separated

**API:** `PUT /api/wallai/profile`
- Body: `{ name?: string, currentPassword?: string, newPassword?: string }`
- Validates current password before allowing password change
- Returns updated user data

### 2. Currency

- Dropdown to select primary display currency
- Options: EUR, USD, GBP, CHF, BRL
- Saves immediately on change (no save button needed)
- Reads from / writes to `User.primaryCurrency` (already in schema, defaults to EUR)

**API:** Same `PUT /api/wallai/profile` endpoint with `{ currency: string }`

### 3. Anthropic API Key

- Existing `ApiKeyCard` component — no changes needed
- Already functional with GET/POST/DELETE on `/api/wallai/api-key`

### 4. API Usage

- **Summary row:** Two stat cards — "Cost this month" (in USD) and "Calls this month" (count)
- **Daily bar chart:** Recharts BarChart showing cost per day for the current month (x-axis: day, y-axis: cost in USD). Uses the same dark glass styling.
- **Per-day breakdown:** Below the chart, clickable day rows that expand to show individual calls: endpoint, model, input/output tokens, cost, timestamp.

**API:** `GET /api/wallai/usage?month=2026-04`
- Returns: `{ totalCost, totalCalls, dailyData: [{ date, cost, calls, details: [{ endpoint, model, inputTokens, outputTokens, cost, createdAt }] }] }`
- Defaults to current month if no query param

## Components

| Component | File | Purpose |
|---|---|---|
| ProfileCard | `src/components/wallai/settings/profile-card.tsx` | Name edit + password change |
| CurrencyCard | `src/components/wallai/settings/currency-card.tsx` | Currency selector |
| UsageCard | `src/components/wallai/settings/usage-card.tsx` | Summary + chart + breakdown |

## Styling

- Same dark glass theme as rest of app (GlassCard, white/emerald accents)
- Single scrollable page, sections stacked vertically
- Max width `lg:max-w-2xl` for the form sections, full width for the usage chart
