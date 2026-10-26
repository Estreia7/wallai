import type { ReactNode } from "react";

/**
 * Course-design cards — WallAI's shared card kit.
 *
 * The look comes from the "course design cards" reference: a solid dark
 * surface a step above the page, one tone per card (green / blue / orange /
 * red) that lights the top edge and the progress fill, a darker footer band
 * holding an avatar stack and a countdown pill, and a lift-and-glow hover.
 *
 * Every piece is exported so product cards can take only what they need:
 *
 *   <CardSurface tone="green" hover>
 *     <CardHeader date="Feb 2, 2021" />
 *     <CardBody title="Web designing" description="Prototyping" />
 *     <CardProgress value={90} />
 *     <CardFooter>
 *       <AvatarStack avatars={[...]} onAdd={...} />
 *       <CountdownPill>2 days left</CountdownPill>
 *     </CardFooter>
 *   </CardSurface>
 *
 * The default export keeps the reference's `CardData` contract so the
 * original demo renders unchanged. Styles live in `src/app/globals.css`
 * under `.card`, `.card-tone-*`, `.card-footer`, `.card-progress-*` and
 * `.card-countdown`.
 */

export type CardTone = "green" | "blue" | "orange" | "red" | "none";

/** Reference colour classes map onto WallAI tones; unknown values fall back to the brand accent. */
const REFERENCE_TONES: Record<string, CardTone> = {
  green: "green",
  blue: "blue",
  orange: "orange",
  red: "red",
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------------- */
/* Icons — authored SVG, 1.5px stroke, so nothing leans on emoji/glyphs.   */
/* ---------------------------------------------------------------------- */

export function EllipsisIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function AddIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Surface                                                                 */
/* ---------------------------------------------------------------------- */

export type CardSurfaceProps = {
  children: ReactNode;
  /** Which colour carries this card's meaning. Defaults to the brand accent. */
  tone?: CardTone;
  /** Lift + tone glow on hover. Turn on for cards that are, or contain, a target. */
  hover?: boolean;
  /** Remove the body padding so headers/footers can run flush to the edge. */
  flush?: boolean;
  className?: string;
  as?: "div" | "article" | "section" | "li";
};

export function CardSurface({
  children,
  tone,
  hover = false,
  flush = false,
  className,
  as: Tag = "div",
}: CardSurfaceProps) {
  return (
    <Tag
      className={cx(
        "card",
        tone && tone !== "none" && `card-tone-${tone}`,
        tone === "none" && "card-tone-none",
        hover && "card-hover",
        !flush && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ---------------------------------------------------------------------- */
/* Header — date on the left, an optional overflow menu on the right.      */
/* ---------------------------------------------------------------------- */

export function CardHeader({
  date,
  children,
  onMenu,
  menuLabel = "More actions",
  className,
}: {
  date?: ReactNode;
  children?: ReactNode;
  onMenu?: () => void;
  menuLabel?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center justify-between gap-3", className)}>
      {date !== undefined ? (
        <span className="text-xs font-medium tabular-nums text-white/70">{date}</span>
      ) : (
        <span>{children}</span>
      )}
      {onMenu && <CardMenuButton onClick={onMenu} label={menuLabel} />}
    </div>
  );
}

export function CardMenuButton({
  onClick,
  label = "More actions",
}: {
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="-mr-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      <EllipsisIcon />
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Body — small title above a bold description, as in the reference.       */
/* ---------------------------------------------------------------------- */

export function CardBody({
  title,
  description,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mt-4", className)}>
      {title && (
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">
          {title}
        </h3>
      )}
      {description && (
        <p className="mt-1 text-lg font-bold leading-tight text-white sm:text-xl">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Progress — label, tone-filled track, value. Fill animates once on mount. */
/* ---------------------------------------------------------------------- */

export function CardProgress({
  value,
  label = "Progress",
  valueLabel,
  className,
}: {
  /** 0–100 */
  value: number;
  label?: ReactNode;
  /** Text shown to the right of the bar; defaults to the rounded percentage. */
  valueLabel?: ReactNode;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("mt-4", className)}>
      <div className="mb-2 flex items-center justify-between text-xs text-white/70">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-white">
          {valueLabel ?? `${Math.round(pct)}%`}
        </span>
      </div>
      <div
        className="card-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className="card-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Footer — darker band holding the avatar stack and the countdown pill.   */
/* ---------------------------------------------------------------------- */

export function CardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "card-footer -mx-4 -mb-4 mt-4 flex items-center justify-between gap-3 px-4 py-3 sm:-mx-5 sm:-mb-5 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type Avatar = { src: string; alt: string };

export function AvatarStack({
  avatars,
  onAdd,
  addLabel = "Add person",
  max = 3,
}: {
  avatars: Avatar[];
  onAdd?: () => void;
  addLabel?: string;
  max?: number;
}) {
  const shown = avatars.slice(0, max);
  const extra = avatars.length - shown.length;
  return (
    <ul className="flex items-center">
      {shown.map((a, i) => (
        <li key={`${a.src}-${i}`} className={i === 0 ? "" : "-ml-2"}>
          <img
            src={a.src}
            alt={a.alt}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-[var(--surface-card-footer)]"
          />
        </li>
      ))}
      {extra > 0 && (
        <li className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-card-raised)] text-[11px] font-semibold text-white ring-2 ring-[var(--surface-card-footer)]">
          +{extra}
        </li>
      )}
      {onAdd && (
        <li className={shown.length ? "-ml-2" : ""}>
          <button
            type="button"
            onClick={onAdd}
            aria-label={addLabel}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[var(--card-tone)] bg-[var(--surface-card-footer)] text-[var(--card-tone)] transition-colors hover:bg-[var(--card-tone)] hover:text-[var(--surface-card-footer)]"
          >
            <AddIcon />
          </button>
        </li>
      )}
    </ul>
  );
}

export function CountdownPill({
  children,
  href,
  onClick,
  className,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  if (href) {
    return (
      <a href={href} className={cx("card-countdown", className)}>
        {children}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cx("card-countdown", className)}>
        {children}
      </button>
    );
  }
  return <span className={cx("card-countdown", className)}>{children}</span>;
}

/* ---------------------------------------------------------------------- */
/* Reference contract — the original demo's `Card` + `CardData`.           */
/* ---------------------------------------------------------------------- */

export interface CardData {
  id: number;
  colorClass: string;
  date: string;
  title: string;
  description: string;
  progressPercent: string;
  progressValue: string;
  imgSrc1?: string;
  imgAlt1?: string;
  imgSrc2?: string;
  imgAlt2?: string;
  countdownText: string;
}

export interface CardProps {
  data: CardData;
  onMenu?: () => void;
  onAdd?: () => void;
}

export default function Card({ data, onMenu, onAdd }: CardProps) {
  const tone = REFERENCE_TONES[data.colorClass] ?? "green";
  const pct = parseFloat(data.progressPercent) || 0;
  const avatars: Avatar[] = [];
  if (data.imgSrc1) avatars.push({ src: data.imgSrc1, alt: data.imgAlt1 ?? "Team member" });
  if (data.imgSrc2) avatars.push({ src: data.imgSrc2, alt: data.imgAlt2 ?? "Team member" });

  return (
    <CardSurface tone={tone} hover as="article">
      <CardHeader date={data.date} onMenu={onMenu} />
      <CardBody title={data.title} description={data.description} />
      <CardProgress value={pct} valueLabel={data.progressValue} />
      <CardFooter>
        <AvatarStack avatars={avatars} onAdd={onAdd} />
        <CountdownPill>{data.countdownText}</CountdownPill>
      </CardFooter>
    </CardSurface>
  );
}
