"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { UsageTrendChart as ChartImpl } from "./usage-trend-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const Lazy = dynamic(() => import("./usage-trend-chart.impl").then((m) => m.UsageTrendChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={220} />,
});

export function UsageTrendChart(props: ComponentProps<typeof ChartImpl>) {
  return <Lazy {...props} />;
}
