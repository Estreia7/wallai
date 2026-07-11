type ChartSkeletonProps = {
  height?: number;
  className?: string;
};

/**
 * Placeholder shown while a chart's recharts chunk is loading.
 * Sized to the chart height to minimise layout shift on mobile.
 */
export function ChartSkeleton({ height = 220, className }: ChartSkeletonProps) {
  return (
    <div
      style={{ minHeight: height }}
      aria-hidden
      className={`w-full animate-pulse rounded-2xl bg-white/5 ${className ?? ""}`}
    />
  );
}
