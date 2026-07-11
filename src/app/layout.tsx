import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { WallAISessionProvider } from "@/components/wallai/session-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WallAI – Personal Finance",
  description: "AI-powered personal finance dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WallAISessionProvider>{children}</WallAISessionProvider>
      </body>
    </html>
  );
}
