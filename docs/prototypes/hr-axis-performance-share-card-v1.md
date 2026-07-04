# Store Me Performance Share Card HR Axis V1

Status: locked
Surface: `/store/me`
Feature: `Performans Kartı Oluştur`
Prototype family: HR Axis palette share card

## Decision

Use the HR Axis palette performance card as the canonical share-card direction.
This is no longer a loose visual exploration. It is the locked product and
visual contract for the first production implementation pass.

The card is a single external-share story asset for store personnel. It should
feel premium, proud, and lightly gamified without becoming a dashboard, table,
or childlike badge screen.

## Primary Flow

1. User opens `/store/me`.
2. User clicks `Performans Kartı Oluştur`.
3. A dialog opens with a live preview of the performance card.
4. User can download the card as PNG.
5. User can close the dialog.

No format picker is included in v1. The only supported output is story format.

## Visual Contract

### Format

- Single story format.
- 9:16 vertical card.
- Export target: PNG.
- Card must fit a mobile story share context.
- Preview must not overflow on mobile.

### Palette

Use the HR Axis palette variant from the approved prototype:

- Dark navy / near-black card base.
- Plum-to-cyan HR Axis energy ring.
- Cyan/plum glass accents.
- White primary typography.
- Subtle teal depth in the lower card.
- No beige/cream/brown palette.
- No noisy rainbow treatment.

### Composition

Required visual order:

1. Top-left brand block:
   - `LUFIAN`
   - `LUFIAN PERFORMANS KARTI`
2. Top-right period pill:
   - example: `Haziran 2026`
3. Center score ring:
   - circular score area
   - static full ring, not a partial progress ring
   - label: `SKOR`
   - value: score only, for example `87`
   - no `/100`
4. Main badge:
   - one primary achievement badge
   - example: `MAĞAZA LİDERİ`
   - badge must include a badge-specific icon
5. Person name:
   - centered
   - strong, proud, large typography
6. Store name:
   - centered directly under person name
7. Ranking panel:
   - one panel only
   - `TÜRKİYE SIRALAMASI`
   - example value: `#24 / 842`
   - percentile pill: example `İlk %3`

## Content Contract

### Show

- Lufian brand text.
- Card label: `LUFIAN PERFORMANS KARTI`.
- Selected period.
- Performance score.
- Personnel display name.
- Store name.
- One main achievement badge.
- Turkey ranking.
- Turkey ranking population.
- Percentile segment.

### Hide

Never show these on the share card:

- revenue
- sales amount
- target amount
- remaining target
- incentive / bonus
- salary
- employee code
- UUID or internal ID
- store commercial details
- internal copy such as API, DB, scope, mock, debug, provider, or contract

## Ranking Contract

Only Turkey ranking is shown in v1.

Do not show Region ranking or Store ranking on the card in v1. Those can remain
inside the Store Me page, but the external share card should stay focused and
not become crowded.

Display format:

- Header: `TÜRKİYE SIRALAMASI`
- Value: `#{rank} / {population}`
- Percentile: `İlk %{percentile}`

Example:

```text
TÜRKİYE SIRALAMASI
#24 / 842
İlk %3
```

## Badge Contract

Canonical badge rules live in:

```text
docs/contracts/store-me-performance-badge-system-v1.md
```

Only one main badge is visible on the card. If multiple badges are eligible,
show the highest-priority badge from the badge-system contract.

Initial priority order:

1. `TÜRKİYE 1.'Sİ`
2. `İLK %1`
3. `MAĞAZA LİDERİ`
4. `BÖLGE İLK 3`
5. `AYIN YÜKSELENİ`
6. `HEDEF ÜSTÜ`
7. `İSTİKRARLI PERFORMANS`

Every badge must have a matching icon. The icon must be meaningful, centered,
and visually balanced with the badge label.

V1 fallback:

- If no special badge is eligible, show no fake badge.
- Do not invent an achievement.
- The card may still be generated with score and ranking only.
- Do not implement a second badge priority table in the share-card component.

## Long Name Contract

The name block must handle long real names without clipping or ellipsis.

Required test case:

```text
Süleyman Mustafa Kuncan Karademir
```

Rules:

- Prefer one line.
- Dynamically reduce font size for long names.
- Minimum readable font size: `30px`.
- If the name still does not fit, wrap to two lines.
- Maximum line count: 2.
- Keep line-height tight, around `0.95`.
- Do not truncate with ellipsis.
- Do not allow three lines.
- Do not allow overlap with the badge, store name, or ranking panel.
- Name area height must be reserved so the rest of the card does not jump.

## Typography Contract

- Brand: compact uppercase.
- Card label: uppercase, smaller than brand.
- Score: largest numeric element.
- Person name: largest text element after score.
- Store name: smaller, muted but readable.
- Ranking value: bold and clear.
- Avoid excessive font weight outside score/name/ranking.

## Export Contract

Button label:

```text
Performans Kartı Oluştur
```

Dialog actions:

```text
PNG indir
Kapat
```

Suggested filename:

```text
lufian-performans-karti-{slug-name}-{yyyy-mm}.png
```

Example:

```text
lufian-performans-karti-ayse-yilmaz-2026-06.png
```

## Data Contract

Use existing Store Me view model data where possible.

Required values:

- `employee.displayName`
- `employee.storeName`
- selected period label
- performance score
- Turkey rank
- Turkey population
- calculated percentile
- resolved badge

If score or Turkey ranking is missing:

- Disable `Performans Kartı Oluştur`, or
- Open the dialog with a clear Turkish unavailable state.

Do not generate a share card with fake score or fake rank in production.

## Implementation Notes

- Production component direction:
  - `StoreMeShareCardDialog`
  - `StoreMeShareCardPreview`
  - optional `resolveStoreMeShareBadge`
- Use shadcn Dialog/Button where it fits the current Store Me route.
- Keep the card itself export-safe: static visual, no animation dependency.
- PNG export can use the existing project-approved lightweight export helper or
  a focused `html-to-image`-style implementation if approved.

## Verification Checklist

Before claiming this implemented:

- Desktop preview screenshot.
- Mobile preview screenshot.
- PNG download opens successfully.
- Turkish characters render correctly:
  - `ğ`, `ü`, `ş`, `ı`, `ö`, `ç`, `İ`
- Long-name test passes:
  - `Süleyman Mustafa Kuncan Karademir`
- Card does not show hidden financial or internal data.
- Only Turkey ranking appears.
- Badge priority chooses one badge only.
- No horizontal overflow on mobile.

## Locked Acceptance

The approved HR Axis palette card is the visual target. Production can adapt
spacing for real data and export constraints, but the following must not change
without a new approval:

- HR Axis dark plum/cyan palette.
- Single story format.
- Center score ring.
- One main badge.
- Person name + store name hierarchy.
- Turkey ranking only.
- No financial/sensitive data.
- Long-name behavior.
