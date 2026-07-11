"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { CryptoChart as ChartImpl } from "./crypto-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const LazyCryptoChart = dynamic(
  () => import("./crypto-chart.impl").then((m) => m.CryptoChart),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);

export function CryptoChart(props: ComponentProps<typeof ChartImpl>) {
  return <LazyCryptoChart {...props} />;
}
