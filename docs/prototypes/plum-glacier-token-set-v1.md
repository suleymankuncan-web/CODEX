# Plum Glacier Token Set V1

Pilot UI calismalarinda tek calisma paleti budur. App genel token refactor'u
degildir; login ve sonraki UI pilotlari icin ortak karar sozlugudur.

## Core

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#f8f5fb` | Ana sayfa zemini |
| `--color-bg-glacier` | `#edf7f6` | Glacier/buz arka plan gecisi |
| `--color-surface` | `rgba(255, 255, 255, 0.88)` | Ana panel yuzeyi |
| `--color-surface-strong` | `#ffffff` | Input, net yuzey |
| `--color-surface-soft` | `rgba(255, 255, 255, 0.68)` | Soft chip/ikincil yuzey |
| `--color-ink` | `#171421` | Ana metin |
| `--color-muted` | `#6c6478` | Ikincil metin |
| `--color-quiet` | `#9e93aa` | Placeholder/yardimci ton |
| `--color-line` | `rgba(36, 28, 50, 0.10)` | Hafif border |
| `--color-line-strong` | `rgba(36, 28, 50, 0.18)` | Input/aktif border |

## Brand And State

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary` | `#7c3aed` | Ana plum/mor |
| `--color-primary-deep` | `#4c2aa5` | Hover, derin vurgu |
| `--color-primary-soft` | `rgba(124, 58, 237, 0.12)` | Soft plum zemin |
| `--color-blue` | `#3765ea` | Mor-cyan kopru tonu |
| `--color-accent` | `#13a7b3` | Glacier/cyan vurgu |
| `--color-accent-soft` | `rgba(19, 167, 179, 0.12)` | Soft glacier zemin |
| `--color-success` | `#10b981` | Basari/aktif durum |
| `--color-warning` | `#f59e0b` | Uyari |
| `--color-danger` | `#e11d48` | Kritik/hata |
| `--color-focus` | `rgba(124, 58, 237, 0.22)` | Klavye focus halkasi |

## Elevation

| Token | Value | Use |
| --- | --- | --- |
| `--shadow-soft` | `0 18px 48px rgba(32, 24, 48, 0.08)` | Hafif hover/panel |
| `--shadow-panel` | `0 24px 80px rgba(32, 24, 48, 0.12)` | Ana panel |

## Usage Rules

- Primary action gradient: `primary -> blue -> accent`.
- Surfaces stay white/glacier, not beige.
- Body text uses `ink`; helper text uses `muted`; placeholder uses `quiet`.
- Focus is always visible and plum-based.
- Do not introduce new purple/cyan hex values in pilot work unless this file is
  updated first.
