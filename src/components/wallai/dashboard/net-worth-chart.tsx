"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { NetWorthChart as ChartImpl } from "./net-worth-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const LazyNetWorthChart = dynamic(
  () => import("./net-worth-chart.impl").then((m) => m.NetWorthChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} className="xl:col-span-2" /> },
);

export function NetWorthChart(props: ComponentProps<typeof ChartImpl>) {
  return <LazyNetWorthChart {...props} />;
}
