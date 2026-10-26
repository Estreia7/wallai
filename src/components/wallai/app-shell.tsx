"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GradientBg } from "./gradient-bg";
import { NavMobile } from "./nav-mobile";
import { NavSidebar } from "./nav-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const router = useRouter();
  const mustChangePassword = session?.user?.mustChangePassword === true;

  // Every route under (app) is private; the public landing lives at "/" and
  // the sign-in form at "/login", so send signed-out visitors to the form.
  // Accounts still on the temporary seed password go to /change-password
  // before they can use the app.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && mustChangePassword) {
      router.replace("/change-password");
    }
  }, [status, mustChangePassword, router]);

  // Loading state
  if (status === "loading") {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <GradientBg />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
          <p className="text-sm text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated — redirect in progress, show nothing
  if (status === "unauthenticated") {
    return null;
  }

  // Authenticated — full app shell
  function handleLogout() {
    signOut({ callbackUrl: "/" });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <GradientBg />
      <NavMobile onLogout={handleLogout} />
      <NavSidebar onLogout={handleLogout} />
      <main className="relative z-0 px-4 pb-8 pt-[calc(3.5rem+env(safe-area-inset-top)+1rem)] sm:px-6 lg:ml-64 lg:p-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
