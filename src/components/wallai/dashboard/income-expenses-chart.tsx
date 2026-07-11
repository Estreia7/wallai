"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { IncomeExpensesChart as ChartImpl } from "./income-expenses-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const LazyIncomeExpensesChart = dynamic(
  () => import("./income-expenses-chart.impl").then((m) => m.IncomeExpensesChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

export function IncomeExpensesChart(props: ComponentProps<typeof ChartImpl>) {
  return <LazyIncomeExpensesChart {...props} />;
}
