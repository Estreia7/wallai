"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { AllocationDonut as ChartImpl } from "./allocation-donut.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const LazyAllocationDonut = dynamic(
  () => import("./allocation-donut.impl").then((m) => m.AllocationDonut),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

export function AllocationDonut(props: ComponentProps<typeof ChartImpl>) {
  return <LazyAllocationDonut {...props} />;
}
