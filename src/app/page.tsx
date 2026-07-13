import type { Metadata } from "next";
import Link from "next/link";
import { GradientBg } from "@/components/wallai/gradient-bg";
import { HeroPanel } from "@/components/wallai/landing/hero-panel";
import { Reveal } from "@/components/wallai/landing/reveal";

export const metadata: Metadata = {
  title: "Wallai — Your money, understood by AI",
  description:
    "Wallai connects your accounts, budgets, crypto, debts and property into one calm dashboard — then an AI explains what's actually happening with your money.",
};

/* Grounded in Wallai's real surfaces: dashboard, budget, analysis, crypto,
   debts, property, bank-statement import. Copy names what the user controls. */
const FEATURES = [
  {
    title: "One number that matters",
    body: "Every account, holding and debt rolls up into a single net-worth figure that updates as your money moves.",
    surface: "Dashboard",
  },
  {
    title: "Budgets that hold up",
    body: "Set limits per category and watch the month unfold. Wallai flags overspend before it becomes a surprise.",
    surface: "Budget",
  },
  {
    title: "Spending, explained",
    body: "See where the money went by category and merchant — with a money-flow view that makes the leaks obvious.",
    surface: "Analysis",
  },
  {
    title: "Crypto, in context",
    body: "Track holdings and P&L next to the rest of your wealth, not siloed in a separate app.",
    surface: "Crypto",
  },
  {
    title: "A plan for what you owe",
    body: "Every loan and card in one place, with a payoff path that shows the finish line.",
    surface: "Debts",
  },
  {
    title: "Import a statement, done",
    body: "Drop in a PDF or CSV. Wallai reads it, categorizes each line, and asks before it assumes.",
    surface: "Bank import",
  },
];

const STEPS = [
  {
    title: "Bring your money in",
    body: "Upload a bank statement or add accounts, crypto, debts and property. Wallai reads statements line by line.",
  },
  {
    title: "Wallai makes sense of it",
    body: "Transactions are categorized and rolled into net worth, budgets and spending — no spreadsheets.",
  },
  {
    title: "Ask, and act",
    body: "The AI surfaces what changed and what to do next, so every decision starts from the full picture.",
  },
];

function Logo() {
  return (
    <span className="text-lg font-bold tracking-tight text-white">
      Wall
      <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
        ai
      </span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <GradientBg />

      {/* ---- Nav ---- */}
      <header className="container-page flex items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="#features"
            className="hidden rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:text-white sm:block"
          >
            Features
          </Link>
          <Link
            href="#how"
            className="hidden rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:text-white sm:block"
          >
            How it works
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white/90 ring-1 ring-white/10 transition-colors hover:bg-white/10"
          >
            Log in
          </Link>
        </nav>
      </header>

      {/* ---- Hero ---- */}
      <section className="container-page grid items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
            AI-powered personal finance
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Your money,
            <br />
            <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              understood by AI.
            </span>
          </h1>

          <p className="lead mt-6 max-w-md text-base sm:text-lg">
            Wallai brings your accounts, budgets, crypto, debts and property into
            one calm dashboard — then explains what&apos;s actually happening,
            in plain language.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-[#04140f] shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:brightness-110"
            >
              Get started
            </Link>
            <Link
              href="#how"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/10"
            >
              See how it works
            </Link>
          </div>

          <p className="mt-5 text-xs text-white/40">
            No spreadsheets. Your data stays yours.
          </p>
        </div>

        <div className="lg:pl-4">
          <HeroPanel />
        </div>
      </section>

      {/* ---- Features ---- */}
      <section id="features" className="container-page px-5 py-16 sm:px-8 sm:py-24">
        <Reveal>
          <span className="kicker">Everything in one place</span>
          <h2 className="section-title mt-3 max-w-2xl">
            The whole picture, not six different apps.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <article className="card card-hover h-full p-6 backdrop-blur-md">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-emerald-300/80">
                  {f.surface}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {f.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- How it works (a genuine sequence → numbering is earned) ---- */}
      <section id="how" className="container-page px-5 py-16 sm:px-8 sm:py-24">
        <Reveal>
          <span className="kicker">How it works</span>
          <h2 className="section-title mt-3 max-w-2xl">
            From raw statements to a clear next move — in three steps.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 100}>
              <div className="relative h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-lg font-bold text-[#04140f]">
                  {i + 1}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- Closing CTA ---- */}
      <section className="container-page px-5 pb-24 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-emerald-500/[0.12] via-white/[0.03] to-cyan-500/[0.12] px-6 py-14 text-center backdrop-blur-md sm:px-16 sm:py-20">
            <div
              className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[100px]"
              aria-hidden
            />
            <h2 className="relative mx-auto max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
              See your whole financial life on one screen.
            </h2>
            <p className="lead relative mx-auto mt-4 max-w-md">
              It takes one statement to start. Wallai does the rest.
            </p>
            <Link
              href="/login"
              className="relative mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-8 py-3.5 text-sm font-semibold text-[#04140f] shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:brightness-110"
            >
              Get started
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ---- Footer ---- */}
      <footer className="container-page flex flex-col items-center justify-between gap-3 border-t border-white/10 px-5 py-8 sm:flex-row sm:px-8">
        <Logo />
        <p className="text-xs text-white/40">
          A playground experiment by Bruno Estreia
        </p>
        <Link
          href="/login"
          className="text-xs text-white/50 transition-colors hover:text-emerald-300"
        >
          Log in →
        </Link>
      </footer>
    </main>
  );
}
