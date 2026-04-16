import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WallAISessionProvider } from "@/components/wallai/session-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WallAI – Personal Finance",
  description: "AI-powered personal finance dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0E1A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WallAISessionProvider>{children}</WallAISessionProvider>
      </body>
    </html>
  );
}
