"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { BudgetYearChart as ChartImpl } from "./budget-year-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const Lazy = dynamic(() => import("./budget-year-chart.impl").then((m) => m.BudgetYearChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={260} />,
});

export function BudgetYearChart(props: ComponentProps<typeof ChartImpl>) {
  return <Lazy {...props} />;
}
