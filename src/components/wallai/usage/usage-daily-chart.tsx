"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { UsageDailyChart as ChartImpl } from "./usage-daily-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const Lazy = dynamic(() => import("./usage-daily-chart.impl").then((m) => m.UsageDailyChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={220} />,
});

export function UsageDailyChart(props: ComponentProps<typeof ChartImpl>) {
  return <Lazy {...props} />;
}
