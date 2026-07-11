"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  BankIcon,
  CryptoIcon,
  DebtsIcon,
  PropertyIcon,
  AnalysisIcon,
  LearnIcon,
  SettingsIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
} from "./nav-icons";

const navItems = [
  { icon: <DashboardIcon />, label: "Dashboard", href: "/dashboard" },
  { icon: <BankIcon />, label: "Bank", href: "/bank" },
  { icon: <CryptoIcon />, label: "Crypto", href: "/crypto" },
  { icon: <DebtsIcon />, label: "Debts", href: "/debts" },
  { icon: <PropertyIcon />, label: "Property", href: "/property" },
  { icon: <AnalysisIcon />, label: "Analysis", href: "/analysis" },
  { icon: <LearnIcon />, label: "Learn", href: "/learn" },
  { icon: <SettingsIcon />, label: "Settings", href: "/settings" },
];

export function NavMobile({ onLogout }: { onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close menu on resize to desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      {/* Top header bar */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-[#0A0E1A]/80 px-4 backdrop-blur-xl lg:hidden">
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
          className="flex h-11 w-11 items-center justify-center rounded-lg text-white/90 transition-colors sm:hover:bg-white/10 sm:hover:text-white"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      {/* Backdrop overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 top-14 z-30 bg-black/60 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Slide-down menu panel. Hidden with opacity+visibility (not just a
          transform) so its bottom edge can't peek below the header — the panel
          is anchored at top-14, so -translate-y-full alone left "Sign out"
          visible and covered the header. */}
      <nav
        className={`fixed left-0 right-0 top-14 z-30 border-b border-white/5 bg-[#0A0E1A]/95 backdrop-blur-xl transition-all duration-200 ease-out lg:hidden ${
          menuOpen
            ? "translate-y-0 opacity-100 visible"
            : "-translate-y-2 opacity-0 invisible pointer-events-none"
        }`}
      >
        <div className="space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-400/10 text-white"
                    : "text-white/80 sm:hover:bg-white/5 sm:hover:text-white"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-emerald-400 to-cyan-400" />
                )}
                <span className={isActive ? "text-emerald-300" : "text-current"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <div className="my-2 border-t border-white/5" />
          <button
            onClick={() => {
              setMenuOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/60 transition-colors sm:hover:bg-red-500/10 sm:hover:text-red-400"
          >
            <LogoutIcon />
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
