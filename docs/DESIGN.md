# UDM Design System

Base rules and guidelines for every page and component of the UD Messinense
website. Distilled from [designmotionhq.com](https://designmotionhq.com/)
pattern breakdowns, applied to our brand. **When in doubt, follow this file.**

---

## 1. Colors (our palette — do not change)

Green is the structure, gold is the accent. Gold is *limited currency*: it is
reserved for the ONE action we want the user to take on each screen.

| Token             | Value     | Role                                            |
| ----------------- | --------- | ----------------------------------------------- |
| `green-primary`   | `#1B7A3D` | Brand green — links, primary buttons            |
| `green-deep`      | `#0E5228` | Dark surfaces (hero, footer), headings          |
| `green-leaf`      | `#2E9E4F` | Hover/active states of green                    |
| `gold`            | `#F4C20D` | THE accent. One primary CTA per screen, badges  |
| `ink`             | `#111111` | Body text                                       |
| `grey-50`         | `#F5F5F5` | Subtle backgrounds                              |
| `grey-500`        | `#6B6B6B` | Secondary text (only on light bg — see §8)      |

Rules:
- **One accent per screen.** Gold marks the single most important action
  ("Associa-te", "Ver jogos"). Never use gold for two competing CTAs in the
  same viewport.
- Don't color every element differently — hierarchy comes from size, weight,
  contrast and spacing (§2), not from rainbow color.
- Name by meaning, not value: use semantic tokens (`--surface`, `--accent`)
  that reference these primitives; never hardcode hex in components.

## 2. Visual hierarchy — five signals, always stacked

Size, weight, contrast, whitespace, color. No single one works alone.

- **Headlines ≈ 2× body text.** Section titles use the display face at
  `text-2xl`–`text-3xl`; page heroes `text-4xl`–`text-6xl`.
- **Weights:** headings 700–800, body 400, captions/labels 500–600 at small
  sizes with uppercase + tracking.
- Secondary text is subordinated with **opacity (55–70%)**, not by shrinking
  it below readable sizes.
- The most important element gets **more padding** than everything else.
- Type scale follows a golden-ratio-flavoured ladder rounded to Tailwind
  steps: 12 → 14 → 16 → 20 → 26 → 42 → 68 (`xs/sm/base/xl/2xl/display/hero`).

## 3. Spacing & grid

- **8px base scale.** All gaps snap to 4/8/12/16/24/40/64. No 13px or 17px.
- **Proximity rule:** gap *within* a group (~8–12px) must be smaller than the
  gap *between* groups (~40px+). Whitespace groups content — reach for
  spacing before borders or dividers.
- **Section rhythm:** vertical padding between page sections is `py-12`
  (48px) minimum, `py-16`–`py-24` for bands. Content inside a section sits
  much tighter than the distance to the next section.
- **12-column grid**, gutters 24px (`gap-6`) as the default; 40px (`gap-10`)
  for editorial/premium areas. Page container: `container-page`
  (max-w-6xl). Anchor elements to shared column edges — alignment separates
  polished from amateur.
- Layout splits favour ~62/38 (golden ratio): main content 62%, sidebar 38%
  (`lg:grid-cols-[1.618fr_1fr]` ≈ `lg:grid-cols-5` as 3+2).

## 4. Border radius — one scale, nested corners computed

| Element               | Radius        |
| --------------------- | ------------- |
| Chips, tooltips       | 4px (`rounded`)      |
| Inputs, buttons       | 8px (`rounded-lg`)   |
| Cards                 | 12px (`rounded-xl`)  |
| Modals, hero panels   | 16px (`rounded-2xl`) |
| Large feature panels  | 24px (`rounded-3xl`) |

- **Nesting formula:** inner radius = outer radius − padding. An image inside
  a `rounded-xl` card with 8px padding gets `rounded` (4px). Flush images
  (no padding) share the card radius via `overflow-hidden`.
- Never pick radii per component; never mix scales.

## 5. Elevation & shadows

Stack layered shadows — never a single flat drop shadow.

- `--shadow-card` (resting): contact `0 1px 3px` + soft ambient spread.
- `--shadow-lift` (hover/raised): deeper contact + wide soft spread.
- Shadows are **tinted with green-deep**, not pure black — a subtle branded
  glow reads premium.
- Elevation encodes importance: reserve the strongest shadow for the most
  important element (live-match panel, primary modal). Most surfaces stay
  low.
- Cards on white get a **hairline border** (`grey-500` at ~15%) so edges stay
  defined; the border + two shadows is the "premium card" recipe.

## 6. Motion

Durations (from the Doherty threshold — respond under 400ms):

| Interaction              | Duration       | Easing                     |
| ------------------------ | -------------- | -------------------------- |
| Tap/press feedback       | < 100ms        | ease-out                   |
| Hover transitions        | ~200ms         | ease-out                   |
| Entrances (reveal, menu) | 200–300ms      | ease-out (decelerate in)   |
| Exits                    | ~150ms (40% faster than entrance) | ease-in |
| List/card stagger        | 50–60ms apart  | —                          |
| Attention (live badge)   | 500–800ms      | may bounce                 |

Rules:
- **Never linear** for start/stop UI — linear is only for continuous motion
  (sponsor marquee, spinners).
- **Card hover anatomy:** lift ~4–8px (`-translate-y-1`) + deepen shadow
  together, 200ms ease-out. Scale the *image* (~1.05) inside an
  `overflow-hidden` frame — **never scale the whole card** (it shifts
  neighbours and breaks the grid).
- Reveal-on-scroll uses native CSS (`animation-timeline: view()`), fading up
  ~16px over 200–300ms; no JS scroll listeners. Cards in a grid cascade in,
  not as one rigid block.
- Everything respects `prefers-reduced-motion: reduce`.

## 7. Cards — the premium recipe

1. Generous padding (16–24px content pages; up to 40px feature panels).
2. Title first: display face, 600–700 weight; body subordinated at ~55–70%
   opacity.
3. Two stacked shadows (see §5) + hairline border.
4. `rounded-xl`, images flush under `overflow-hidden`.
5. Hover: lift + shadow deepen + image scale — 200ms ease-out.

## 8. Color accessibility

- Body text ≥ **4.5:1** contrast; large text ≥ **3:1**. The background
  decides legibility — verify every text/background pair.
- `grey-500` (#6B6B6B) passes on white/grey-50 only. On green/dark surfaces
  use `text-white/80` (never grey tokens).
- Gold on white fails for text — gold text only on `green-deep`/dark; gold
  *backgrounds* take `ink` text.
- Never encode meaning with color alone (≈8% of users are color-blind):
  pair state colors with icons or labels (e.g. W/D/L letters, not just dots).

## 9. Focus & keyboard

- Never `outline: none` without a replacement. Global rule: `:focus-visible`
  ring, **2px thick, 2px offset**, `green-primary` on light surfaces / `gold`
  on dark surfaces (visible on both).
- Focus follows DOM order; don't let CSS reordering desync tab flow.

## 10. Page skeleton (landing pattern)

Homepage follows **Hero → Proof → Content → CTA**:

1. **Hero** answers three questions in ~3 seconds: what (o clube), who
   (Messines/Algarve), why care (próximo jogo / ao vivo). Headline + subhead
   + ONE gold CTA. No carousels/sliders in the hero.
2. **Proof directly below the hero:** club numbers (anos de história,
   atletas, escalões), sponsors, standings position.
3. Content sections (notícias, classificação) with clear hierarchy.
4. **Repeat the CTA** at the bottom (sócios band) with the same color/copy
   as the top.

Inner pages: title block (kicker + h1 + lead at 70% opacity), then content
on the same grid.

## 11. States

- **Empty states** are designed, not blank: small icon/illustration + warm
  PT copy + one primary action. Never "Sem dados." alone, never a bare
  screen.
- **Loading:** skeletons that match the real content's dimensions, with
  shimmer; only for loads > 300ms. Don't mix spinners and skeletons in one
  view.
- **Errors:** say what happened and the next step, in human Portuguese
  ("Não encontrámos essa página — volta à página inicial"), never technical
  jargon.

## 12. Microcopy (PT-PT)

- Buttons name the **reward, not the mechanic**: "Torna-te sócio" not
  "Submeter"; "Ver todos os jogos" not "Mais".
- Conversational club tone (tratamento por "tu", como já usamos:
  "Associa-te", "Torna-te sócio").
- Labels always visible — placeholder text never replaces a label.

## 13. Gradients & dark surfaces

- Gradients stay **within ~60° of hue travel** (green-deep → green-primary
  is ideal; never green → gold as a text background) and move in one
  lightness direction only.
- Use gradients as atmosphere *behind* content, subtle; never place body
  text on a gradient's mid-transition zone.
- Dark mode / dark bands = swap token sets (white → green-deep surface,
  ink → white text), never naive inversion.

## 14. Navigation

- Primary navigation stays visible: horizontal bar on desktop (sticky,
  translucent white + blur), the mobile menu holds the same full list —
  never hide desktop nav behind a hamburger.
- Active page is marked (green text + gold underline indicator).
- 3–5 core destinations first (Notícias, Equipas, Jogos, Classificação);
  institutional links follow.

---

### Implementation map

- Primitives + semantic tokens: `src/app/globals.css` (`:root`) and
  `tailwind.config.ts` (mirrored — keep in sync).
- Component recipes (`.card`, `.btn-*`, `.section-title`, `.badge-live`,
  `.reveal`): `src/app/globals.css` `@layer components`.
- Shared UI: `src/components/` — every new component must use the recipes
  above instead of ad-hoc classes.
