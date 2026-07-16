"use client";

import { useEffect, useRef, useState } from "react";

// The parse is a single request with no server-side progress stream, so the
// bar is a friendly simulation: it eases toward a ceiling (~95%) while we wait,
// then the parent flips `done` to snap it to 100%. Messages rotate to make the
// wait feel alive.

const MESSAGES = [
  "Teaching Claude to read your bank's handwriting…",
  "Squinting at tiny transaction numbers…",
  "Decoding cryptic merchant names…",
  "Bribing the PDF to reveal its secrets…",
  "Counting your coffees ☕…",
  "Untangling debits from credits…",
  "Asking your bank why they format it like that…",
  "Sorting the groceries from the guilt purchases…",
  "Matching merchants to categories…",
  "Almost there — just double-checking the maths…",
  "Rounding up the last few cents…",
];

const CEILING = 95;

export function ParsingProgress({ done }: { done: boolean }) {
  const [pct, setPct] = useState(6);
  const [msgIndex, setMsgIndex] = useState(0);
  const doneRef = useRef(done);
  doneRef.current = done;

  // Ease toward the ceiling while waiting; jump to 100 when done.
  useEffect(() => {
    if (done) {
      setPct(100);
      return;
    }
    const id = setInterval(() => {
      setPct((p) => {
        if (doneRef.current) return 100;
        if (p >= CEILING) return CEILING;
        // Approach the ceiling with diminishing steps so it slows near the top.
        const step = Math.max(0.4, (CEILING - p) * 0.06);
        return Math.min(CEILING, p + step);
      });
    }, 180);
    return () => clearInterval(id);
  }, [done]);

  // Rotate the funny messages.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, [done]);

  const label = done ? "Done! Tidying up…" : MESSAGES[msgIndex];

  return (
    <div className="w-full max-w-xs">
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
        <p className="text-sm text-white/70 transition-opacity duration-300">{label}</p>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-1.5 text-center text-[11px] font-medium tabular-nums text-emerald-300">
        {Math.round(pct)}%
      </p>
    </div>
  );
}
