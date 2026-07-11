"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ProfileRadar as ChartImpl } from "./profile-radar.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const LazyProfileRadar = dynamic(
  () => import("./profile-radar.impl").then((m) => m.ProfileRadar),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

export function ProfileRadar(props: ComponentProps<typeof ChartImpl>) {
  return <LazyProfileRadar {...props} />;
}
