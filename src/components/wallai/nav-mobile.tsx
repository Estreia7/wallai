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
  { icon: <DashboardIcon />, label: "Dashboard", href: "/wallai/dashboard" },
  { icon: <BankIcon />, label: "Bank", href: "/wallai/bank" },
  { icon: <CryptoIcon />, label: "Crypto", href: "/wallai/crypto" },
  { icon: <DebtsIcon />, label: "Debts", href: "/wallai/debts" },
  { icon: <PropertyIcon />, label: "Property", href: "/wallai/property" },
  { icon: <AnalysisIcon />, label: "Analysis", href: "/wallai/analysis" },
  { icon: <LearnIcon />, label: "Learn", href: "/wallai/learn" },
  { icon: <SettingsIcon />, label: "Settings", href: "/wallai/settings" },
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
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      {/* Backdrop overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Slide-down menu panel */}
      <nav
        className={`fixed left-0 right-0 top-[57px] z-25 transform border-b border-white/5 bg-[#0A0E1A]/95 backdrop-blur-2xl transition-all duration-300 ease-in-out lg:hidden ${
          menuOpen
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: 25 }}
      >
        <div className="space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
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
            onClick={() => {
              setMenuOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/40 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <LogoutIcon />
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
