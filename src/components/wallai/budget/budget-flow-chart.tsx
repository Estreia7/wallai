"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { BudgetFlowChart as ChartImpl } from "./budget-flow-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const Lazy = dynamic(() => import("./budget-flow-chart.impl").then((m) => m.BudgetFlowChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={340} />,
});

export function BudgetFlowChart(props: ComponentProps<typeof ChartImpl>) {
  return <Lazy {...props} />;
}
