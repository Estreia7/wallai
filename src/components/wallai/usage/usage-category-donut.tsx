"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { UsageCategoryDonut as ChartImpl } from "./usage-category-donut.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const Lazy = dynamic(() => import("./usage-category-donut.impl").then((m) => m.UsageCategoryDonut), {
  ssr: false,
  loading: () => <ChartSkeleton height={220} />,
});

export function UsageCategoryDonut(props: ComponentProps<typeof ChartImpl>) {
  return <Lazy {...props} />;
}
