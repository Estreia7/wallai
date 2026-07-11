"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { BudgetMonthChart as ChartImpl } from "./budget-month-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const Lazy = dynamic(() => import("./budget-month-chart.impl").then((m) => m.BudgetMonthChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={260} />,
});

export function BudgetMonthChart(props: ComponentProps<typeof ChartImpl>) {
  return <Lazy {...props} />;
}
