import { CardSurface, type CardTone } from "@/components/ui/course-design-cards";

/**
 * The app's everyday card. Same API as before (children + className), now
 * rendered on the shared course-card surface from `@/components/ui`.
 *
 * - `tone` picks the colour that lights the card's top edge, corner wash
 *   and hover glow. Leave it off for the brand accent.
 * - `hover` turns on the lift + glow. Use it on cards that are, or hold,
 *   a target; leave static read-only panels still.
 */
export function GlassCard({
  children,
  className = "",
  tone,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: CardTone;
  hover?: boolean;
}) {
  return (
    <CardSurface tone={tone} hover={hover} className={className}>
      {children}
    </CardSurface>
  );
}
