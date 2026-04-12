# WallAI Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full settings page with profile editing, currency selector, and API usage tracking with daily cost chart and per-day call breakdown.

**Architecture:** Server component settings page that loads user data and usage stats, with client sub-components for interactive forms and charts. One new API route for profile updates, one for usage data. Existing API key card stays unchanged.

**Tech Stack:** Next.js 16, Prisma, Recharts, Tailwind CSS 4, bcryptjs

**Spec:** `docs/specs/2026-04-12-wallai-settings-design.md`

---

## File Structure

```
src/
  app/
    api/wallai/
      profile/route.ts              (CREATE — PUT handler for name, password, currency)
      usage/route.ts                (CREATE — GET handler for monthly usage data)
    wallai/
      settings/page.tsx             (MODIFY — replace placeholder with full settings page)
  components/wallai/
    settings/
      profile-card.tsx              (CREATE — name edit + password change form)
      currency-card.tsx             (CREATE — currency dropdown selector)
      usage-card.tsx                (CREATE — summary stats + daily chart + expandable breakdown)
```

---

## Task 1: Profile API Route

**Files:**
- Create: `src/app/api/wallai/profile/route.ts`

- [ ] **Step 1: Create the profile PUT route**

Create `src/app/api/wallai/profile/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, currency, currentPassword, newPassword } = body;

  const data: Record<string, string> = {};

  if (typeof name === "string" && name.trim().length > 0) {
    data.name = name.trim();
  }

  if (typeof currency === "string" && ["EUR", "USD", "GBP", "CHF", "BRL"].includes(currency)) {
    data.primaryCurrency = currency;
  }

  if (currentPassword && newPassword) {
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json({ error: "No password set" }, { status: 400 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    data.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { name: true, email: true, primaryCurrency: true },
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 2: Test the route manually**

Run:
```bash
curl -s http://localhost:3000/api/wallai/profile -X PUT -H "Content-Type: application/json" -d '{}' | head
```

Expected: `{"error":"Unauthorized"}` with status 401 (no session).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wallai/profile/route.ts
git commit -m "feat(settings): add profile update API route"
```

---

## Task 2: Usage API Route

**Files:**
- Create: `src/app/api/wallai/usage/route.ts`

- [ ] **Step 1: Create the usage GET route**

Create `src/app/api/wallai/usage/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");

  const now = new Date();
  let year: number, month: number;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m;
  } else {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  const usageRows = await prisma.apiUsage.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: startDate, lt: endDate },
    },
    orderBy: { createdAt: "asc" },
  });

  let totalCost = 0;
  const dailyMap = new Map<string, {
    date: string;
    cost: number;
    calls: number;
    details: Array<{
      endpoint: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      cost: number;
      createdAt: string;
    }>;
  }>();

  for (const row of usageRows) {
    totalCost += row.estimatedCost;
    const dayKey = row.createdAt.toISOString().split("T")[0];

    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, { date: dayKey, cost: 0, calls: 0, details: [] });
    }
    const day = dailyMap.get(dayKey)!;
    day.cost += row.estimatedCost;
    day.calls += 1;
    day.details.push({
      endpoint: row.endpoint,
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cost: row.estimatedCost,
      createdAt: row.createdAt.toISOString(),
    });
  }

  return NextResponse.json({
    totalCost,
    totalCalls: usageRows.length,
    dailyData: Array.from(dailyMap.values()),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/wallai/usage/route.ts
git commit -m "feat(settings): add usage API route with daily breakdown"
```

---

## Task 3: Profile Card Component

**Files:**
- Create: `src/components/wallai/settings/profile-card.tsx`

- [ ] **Step 1: Create the ProfileCard component**

Create `src/components/wallai/settings/profile-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";

type ProfileCardProps = {
  initialName: string;
  email: string;
};

export function ProfileCard({ initialName, email }: ProfileCardProps) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name === initialName) return;
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/wallai/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (res.ok) {
      setMessage({ type: "success", text: "Name updated." });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Failed to update name." });
    }
    setSaving(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);

    if (newPassword.length < 6) {
      setPwMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Passwords don't match." });
      return;
    }

    setPwSaving(true);

    const res = await fetch("/api/wallai/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setPwMessage({ type: "success", text: "Password changed." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const data = await res.json().catch(() => ({}));
      setPwMessage({ type: "error", text: data.error || "Failed to change password." });
    }
    setPwSaving(false);
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-emerald-400/50 focus:bg-white/10 focus:ring-1 focus:ring-emerald-400/30";
  const btnClass =
    "rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 disabled:opacity-40";

  return (
    <GlassCard>
      <h3 className="mb-4 text-sm font-semibold text-white">Profile</h3>

      {/* Email (read-only) */}
      <div className="mb-4">
        <label className="mb-1 block text-xs text-white/40">Email</label>
        <p className="text-sm text-white/60">{email}</p>
      </div>

      {/* Name */}
      <form onSubmit={handleNameSave} className="mb-6">
        <label className="mb-1 block text-xs text-white/40">Name</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={saving || !name.trim() || name === initialName}
            className={btnClass}
          >
            {saving ? "..." : "Save"}
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-xs ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {message.text}
          </p>
        )}
      </form>

      {/* Password change */}
      <div className="border-t border-white/10 pt-4">
        <h4 className="mb-3 text-xs font-semibold text-white/60">Change Password</h4>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className={inputClass}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className={inputClass}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
            className={btnClass}
          >
            {pwSaving ? "Changing..." : "Change Password"}
          </button>
        </form>
        {pwMessage && (
          <p className={`mt-2 text-xs ${pwMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {pwMessage.text}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wallai/settings/profile-card.tsx
git commit -m "feat(settings): add ProfileCard component"
```

---

## Task 4: Currency Card Component

**Files:**
- Create: `src/components/wallai/settings/currency-card.tsx`

- [ ] **Step 1: Create the CurrencyCard component**

Create `src/components/wallai/settings/currency-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";

const CURRENCIES = [
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "US Dollar (USD)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "BRL", label: "Brazilian Real (BRL)" },
];

type CurrencyCardProps = {
  initialCurrency: string;
};

export function CurrencyCard({ initialCurrency }: CurrencyCardProps) {
  const [currency, setCurrency] = useState(initialCurrency);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleChange(newCurrency: string) {
    if (newCurrency === currency) return;
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/wallai/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: newCurrency }),
    });

    if (res.ok) {
      setCurrency(newCurrency);
      setMessage({ type: "success", text: "Currency updated." });
    } else {
      setMessage({ type: "error", text: "Failed to update currency." });
    }
    setSaving(false);
  }

  return (
    <GlassCard>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">Display Currency</h3>
        <p className="mt-1 text-xs text-white/40">
          All values across the app will be shown in this currency.
        </p>
      </div>

      <select
        value={currency}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-emerald-400/50 focus:bg-white/10 focus:ring-1 focus:ring-emerald-400/30 disabled:opacity-40"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code} className="bg-[#0A0E1A] text-white">
            {c.label}
          </option>
        ))}
      </select>

      {message && (
        <p className={`mt-2 text-xs ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wallai/settings/currency-card.tsx
git commit -m "feat(settings): add CurrencyCard component"
```

---

## Task 5: Usage Card Component

**Files:**
- Create: `src/components/wallai/settings/usage-card.tsx`

- [ ] **Step 1: Create the UsageCard component**

Create `src/components/wallai/settings/usage-card.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/wallai/glass-card";

type UsageDetail = {
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  createdAt: string;
};

type DailyData = {
  date: string;
  cost: number;
  calls: number;
  details: UsageDetail[];
};

type UsageResponse = {
  totalCost: number;
  totalCalls: number;
  dailyData: DailyData[];
};

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short" }).format(d);
}

function formatCost(v: number): string {
  return `$${v.toFixed(4)}`;
}

function formatModel(model: string): string {
  if (model.includes("haiku")) return "Haiku";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  return model;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { calls: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-[#0A0E1A]/90 px-3 py-2 text-xs backdrop-blur-lg">
      <p className="font-semibold text-emerald-400">{formatCost(data.value)}</p>
      <p className="text-white/50">{data.payload.calls} call{data.payload.calls !== 1 ? "s" : ""}</p>
    </div>
  );
}

export function UsageCard() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wallai/usage")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold text-white">API Usage</h3>
        <p className="text-xs text-white/40">Loading...</p>
      </GlassCard>
    );
  }

  if (!data) {
    return (
      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold text-white">API Usage</h3>
        <p className="text-xs text-white/40">Failed to load usage data.</p>
      </GlassCard>
    );
  }

  const chartData = data.dailyData.map((d) => ({
    ...d,
    label: formatDay(d.date),
  }));

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 sm:text-xs">
              Cost this month
            </p>
            <p className="mt-1 text-lg font-bold text-white sm:mt-2 sm:text-2xl">
              {formatCost(data.totalCost)}
            </p>
          </div>
        </GlassCard>
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 sm:text-xs">
              API calls this month
            </p>
            <p className="mt-1 text-lg font-bold text-white sm:mt-2 sm:text-2xl">
              {data.totalCalls}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Daily chart */}
      {chartData.length > 0 && (
        <GlassCard className="relative overflow-hidden">
          <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
            Daily Cost
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="rgba(255,255,255,0.2)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `$${v.toFixed(3)}`}
                width={55}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                content={<ChartTooltip />}
              />
              <Bar dataKey="cost" name="Cost" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* Per-day breakdown */}
      {data.dailyData.length > 0 && (
        <GlassCard>
          <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">
            Daily Breakdown
          </h3>
          <div className="space-y-1">
            {data.dailyData.map((day) => (
              <div key={day.date}>
                <button
                  onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{formatDay(day.date)}</span>
                    <span className="text-xs text-white/40">{day.calls} call{day.calls !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-emerald-400">{formatCost(day.cost)}</span>
                    <svg
                      className={`h-4 w-4 text-white/30 transition-transform ${expandedDay === day.date ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expandedDay === day.date && (
                  <div className="mb-2 ml-3 border-l border-white/10 pl-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-white/30">
                          <th className="pb-1 text-left font-medium">Time</th>
                          <th className="pb-1 text-left font-medium">Endpoint</th>
                          <th className="pb-1 text-left font-medium">Model</th>
                          <th className="pb-1 text-right font-medium">Tokens</th>
                          <th className="pb-1 text-right font-medium">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.details.map((d, i) => (
                          <tr key={i} className="text-white/60">
                            <td className="py-1">{formatTime(d.createdAt)}</td>
                            <td className="py-1">{d.endpoint}</td>
                            <td className="py-1">{formatModel(d.model)}</td>
                            <td className="py-1 text-right">
                              {(d.inputTokens + d.outputTokens).toLocaleString()}
                            </td>
                            <td className="py-1 text-right text-emerald-400/80">
                              {formatCost(d.cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wallai/settings/usage-card.tsx
git commit -m "feat(settings): add UsageCard with chart and daily breakdown"
```

---

## Task 6: Wire Up Settings Page

**Files:**
- Modify: `src/app/wallai/settings/page.tsx`

- [ ] **Step 1: Replace the settings page with full layout**

Replace the entire contents of `src/app/wallai/settings/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileCard } from "@/components/wallai/settings/profile-card";
import { CurrencyCard } from "@/components/wallai/settings/currency-card";
import { ApiKeyCard } from "@/components/wallai/api-key-card";
import { UsageCard } from "@/components/wallai/settings/usage-card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/wallai");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, primaryCurrency: true },
  });

  if (!user) {
    redirect("/wallai");
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Settings</h2>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:max-w-2xl">
          <ProfileCard initialName={user.name || ""} email={user.email} />
          <CurrencyCard initialCurrency={user.primaryCurrency} />
          <ApiKeyCard />
        </div>
        <div>
          <UsageCard />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page loads**

Run:
```bash
cd /var/www/wallai && npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/wallai/settings/page.tsx
git commit -m "feat(settings): wire up full settings page with all sections"
```
