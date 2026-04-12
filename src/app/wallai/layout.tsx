import type { Metadata } from "next";
import { WallAISessionProvider } from "@/components/wallai/session-provider";
import { AppShell } from "@/components/wallai/app-shell";

export const metadata: Metadata = {
  title: "WallAI – Personal Finance",
  description: "AI-powered personal finance dashboard",
};

export default function WallAILayout({ children }: { children: React.ReactNode }) {
  return (
    <WallAISessionProvider>
      <AppShell>{children}</AppShell>
    </WallAISessionProvider>
  );
}
