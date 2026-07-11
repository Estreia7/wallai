"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { MonthlyFlowChart as ChartImpl } from "./monthly-flow-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const LazyMonthlyFlowChart = dynamic(
  () => import("./monthly-flow-chart.impl").then((m) => m.MonthlyFlowChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

export function MonthlyFlowChart(props: ComponentProps<typeof ChartImpl>) {
  return <LazyMonthlyFlowChart {...props} />;
}
