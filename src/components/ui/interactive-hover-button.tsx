import * as React from "react";
import Link, { type LinkProps } from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Interactive hover button — WallAI's primary action.
 *
 * A dark pill with a small accent dot beside the label. On hover the dot
 * grows to fill the pill while the label slides out and returns, with an
 * arrow, on the accent. Tokens: the fill is `--color-primary` (the brand
 * accent) and the hover text `--color-primary-foreground`, both set in
 * `globals.css`. Use `InteractiveHoverLink` for navigation.
 */

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, string> = {
  sm: "px-3.5 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-sm",
};

const BASE =
  "group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[var(--surface-card-footer)] font-semibold text-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

function HoverLayers({ text }: { text: React.ReactNode }) {
  return (
    <>
      {/* Resting label with its dot — slides right and fades as the fill takes over */}
      <span className="relative z-20 inline-flex items-center gap-2 whitespace-nowrap transition-all duration-300 ease-out group-hover:translate-x-12 group-hover:opacity-0">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
        {text}
      </span>
      {/* Hover label — arrives from the right, on the accent fill */}
      <span
        aria-hidden="true"
        className="absolute inset-0 z-30 flex translate-x-12 items-center justify-center gap-2 whitespace-nowrap text-primary-foreground opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100"
      >
        <span>{text}</span>
        <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
      </span>
      {/* The fill — the signature: a point near the dot grows into the whole pill */}
      <span
        aria-hidden="true"
        className="absolute left-[14%] top-1/2 z-10 h-2 w-2 -translate-y-1/2 scale-0 rounded-full bg-primary transition-transform duration-300 ease-out group-hover:scale-[80]"
      />
    </>
  );
}

export interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The label. Falls back to `children`. */
  text?: React.ReactNode;
  size?: Size;
}

const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(({ text, children, size = "md", className, type = "button", ...props }, ref) => {
  return (
    <button ref={ref} type={type} className={cn(BASE, SIZE[size], className)} {...props}>
      <HoverLayers text={text ?? children} />
    </button>
  );
});
InteractiveHoverButton.displayName = "InteractiveHoverButton";

export interface InteractiveHoverLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">,
    Pick<LinkProps, "href" | "prefetch" | "replace" | "scroll"> {
  text?: React.ReactNode;
  size?: Size;
}

const InteractiveHoverLink = React.forwardRef<
  HTMLAnchorElement,
  InteractiveHoverLinkProps
>(({ text, children, size = "md", className, ...props }, ref) => {
  return (
    <Link ref={ref} className={cn(BASE, SIZE[size], className)} {...props}>
      <HoverLayers text={text ?? children} />
    </Link>
  );
});
InteractiveHoverLink.displayName = "InteractiveHoverLink";

export { InteractiveHoverButton, InteractiveHoverLink };
