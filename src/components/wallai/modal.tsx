"use client";

import { useEffect } from "react";

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[calc(100dvh-1rem)] w-full flex-col rounded-2xl border border-white/10 bg-[#0A0E1A]/95 shadow-2xl backdrop-blur-2xl sm:max-h-[calc(100dvh-2rem)] ${
          size === "lg" ? "max-w-3xl" : "max-w-md"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
          <h3 className="text-base font-bold text-white sm:text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
