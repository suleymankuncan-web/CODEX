# Command Canvas Visual Contract

This reference freezes the approved HR Axis prototype visual grammar. Use the
values directly in isolated prototypes. In production, map them to shared
semantic tokens instead of copying raw hex values into route code.

## Typography

- Body, controls, table copy: `DM Sans`, weights 400, 500, 600, 700.
- Page titles, section titles, metric values: `Manrope`, weights 500, 600, 700.
- Desktop page title: approximately 31px/1.1.
- Mobile page title: approximately 25px/1.1.
- Section title: 16-20px depending on hierarchy.
- Metric value: 18-26px with tabular numerals.
- Body/helper copy: 10-14px according to density.
- Dense desktop labels may use 8-10px; decision-bearing mobile copy should not
  fall below 10px.
- Use tight title tracking only: approximately `-0.04em`. Do not apply negative
  tracking to body copy.
- Do not use decorative italic text.

## Prototype Color Mapping

| Intent | Prototype value | Production direction |
| --- | --- | --- |
| Page foundation | `#f8f6fb` | `--background` |
| Glacier foundation | `#f5faf9` | background/accent composition |
| Main surface | `rgba(255,255,255,.90)` | `--card` |
| Strong surface | `#ffffff` | `--popover` / `--card` |
| Ink | `#20192b` | `--foreground` |
| Muted | `#736d7d` | `--muted-foreground` |
| Quiet | `#948d9c` | muted/placeholder token |
| Line | `rgba(39,29,52,.11)` | `--border` |
| Primary plum | `#7049e8` | `--primary` |
| Deep plum | `#4c2aa5` | primary emphasis |
| Soft plum | `#f7f3ff` | `--secondary` / `--accent` |
| Bridge blue | `#3765ea` | information emphasis |
| Accent cyan | `#13a7b3` | accent emphasis |
| Success | `#15956f` | success token |
| Warning | `#e09a18` | warning token |
| Danger | `#dc3f67` | destructive/danger token |

Do not change global production token values merely to match a lab hex. Make
global theme changes only through a separate explicit decision.

## Surface And Shape

- Page background: very light plum-to-glacier transition, never a dominant
  decorative gradient.
- Main surfaces: white or lightly translucent white with a subtle border.
- Main surface radius: 12-15px.
- Compact control radius: 7-10px.
- Soft shadow: approximately `0 18px 50px rgba(44,31,59,.07)`.
- Overlay shadow may be stronger but must remain neutral, not neon.
- The thin plum-blue-cyan top edge on metric/surface bands is an HR Axis
  signature treatment. Use once per major band, not on every card.
- Avoid orbs, oversized gradient blocks, glass-card stacks, marketing heroes,
  and decorative nested cards.

## Density And Rhythm

- Desktop content width should usually stay within 1180-1280px for operational
  workspaces unless the workflow genuinely needs more.
- Desktop page padding: approximately 28-68px, responsive to viewport.
- Major section gap: 14-30px.
- Compact toolbar/control height: 34-38px.
- Mobile interactive hit area: at least 44px even when the visual control is
  compact.
- Standard dense desktop row: approximately 60-72px.
- Table/grid gaps: approximately 8-12px.
- Use four metric items only when all four change a decision. Use fewer when
  the workflow needs fewer.

## Metric Treatment

- Use a compact strip or restrained cards, not oversized KPI tiles.
- Include exactly one small meaningful lucide icon per metric.
- Make the numeric value the strongest element.
- Keep label and note short and decision-oriented.
- Make a metric clickable only when it filters or navigates; expose selected
  state with `aria-pressed` and visible styling.
- Never show a decorative metric that lacks a real source or honest fixture
  label in concept-only work.
