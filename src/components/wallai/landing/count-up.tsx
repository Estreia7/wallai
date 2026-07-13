"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Count-up readout for the hero net-worth figure — the landing page's
 * signature moment. Animates from 0 to `value` once, on mount, easing out so
 * the number "settles" like a live balance. Respects reduced-motion by
 * snapping straight to the final value.
 */
export function CountUp({
  value,
  durationMs = 1600,
  prefix = "",
  className = "",
}: {
  value: number;
  durationMs?: number;
  prefix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    let start: number | null = null;
    // easeOutExpo — fast rush, gentle settle (matches the DESIGN.md ease-out).
    const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min((now - start) / durationMs, 1);
      setDisplay(value * ease(progress));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, durationMs]);

  const formatted = new Intl.NumberFormat("en-IE", {
    maximumFractionDigits: 0,
  }).format(Math.round(display));

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {formatted}
    </span>
  );
}
