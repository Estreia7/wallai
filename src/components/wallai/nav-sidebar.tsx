"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  BankIcon,
  CryptoIcon,
  DebtsIcon,
  PropertyIcon,
  AnalysisIcon,
  BudgetIcon,
  LearnIcon,
  UsageIcon,
  SettingsIcon,
  LogoutIcon,
} from "./nav-icons";

const navItems = [
  { icon: <DashboardIcon />, label: "Dashboard", href: "/dashboard" },
  { icon: <BankIcon />, label: "Bank", href: "/bank" },
  { icon: <CryptoIcon />, label: "Crypto", href: "/crypto" },
  { icon: <DebtsIcon />, label: "Debts", href: "/debts" },
  { icon: <PropertyIcon />, label: "Property", href: "/property" },
  { icon: <AnalysisIcon />, label: "Analysis", href: "/analysis" },
  { icon: <BudgetIcon />, label: "Budget", href: "/budget" },
  { icon: <LearnIcon />, label: "Learn", href: "/learn" },
  { icon: <UsageIcon />, label: "AI Usage", href: "/usage" },
  { icon: <SettingsIcon />, label: "Settings", href: "/settings" },
];

export function NavSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [todoCount, setTodoCount] = useState(0);

  useEffect(() => {
    fetch("/api/wallai/todos")
      .then((r) => r.json())
      .then((d) => setTodoCount(d.todos?.length ?? 0))
      .catch(() => {});
  }, [pathname]);

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
          <p className="text-[10px] uppercase tracking-widest text-white/50">Finance</p>
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-400/10 text-white shadow-lg shadow-emerald-500/10"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-emerald-400 to-cyan-400" />
              )}
              <span className={isActive ? "text-emerald-300" : "text-current"}>{item.icon}</span>
              {item.label}
              {item.href === "/dashboard" && todoCount > 0 && (
                <span className="ml-auto rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                  {todoCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <LogoutIcon />
          Sign out
        </button>
      </div>
    </aside>
  );
}
