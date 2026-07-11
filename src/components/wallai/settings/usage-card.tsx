"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const LazyUsageCard = dynamic(
  () => import("./usage-card.impl").then((m) => m.UsageCard),
  { ssr: false, loading: () => <ChartSkeleton height={320} /> },
);

export function UsageCard() {
  return <LazyUsageCard />;
}
