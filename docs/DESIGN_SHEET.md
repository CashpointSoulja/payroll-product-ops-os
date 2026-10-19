# Design sheet

Built by reading deel.com's public homepage HTML and its five production stylesheets (October 2026), then counting which tokens actually appear. The concept mirrors that language so it reads as "could live inside the product", and labels itself **unofficial concept** next to the logo.

## Source

- `https://www.deel.com/` HTML (≈ 950 KB)
- `website-media.deel.com/_next/static/css/*.css` (5 files)
- Logo: `website-media.deel.com/logo_revamp_*.svg`, 78 × 27, single path set filled `#1B1B1B`, used inline with `currentColor`

## Colour

| Token | Hex | Where Deel uses it | Where this concept uses it |
|---|---|---|---|
| `--color-primary` | `#1B1B1B` | Text, logo, primary buttons (195 occurrences, the most common colour) | Text, P0 chip, primary buttons, active tab |
| secondary text | `rgba(27,27,27,.85)` / `.6` | Body copy, muted text | Same |
| hover | `#4E4E4E` | Primary button hover | Same |
| `--color-surface-primary` | `#FFFFFF` | Cards | Cards, top bar |
| `--color-surface-secondary` / latte-25 | `#FFFBF4` | Warm page background | Page background |
| latte-125 | `#FAF4EE` | Section bands | Sample-data notice, formula blocks |
| purple-950 | `#201547` | Dark hero | Hero base |
| `--color-purple-gradient-dark` | `linear-gradient(118deg,#5938b700 48.33%,#5938b7 92.96%),#201547` | Dark hero sections | Overview hero |
| purple-750 | `#5938B7` | Brand accent | Eyebrows, sliders, score bars, step numbers |
| purple-325 / 175 | `#D6C9FD` / `#EDE5FF` | Lavender fills | P1 chip, "unofficial concept" tag |
| blue-175 / 900 | `#DBEEFF` / `#163462` | Blue surfaces | P2 chip, "On track" |
| cornbread-300 / 400 | `#FFE27C` / `#FFCF25` | Yellow highlights | "At risk", "pending" |
| green-250 / 750 | `#C2EEB5` / `#005B01` | Success | "Done", "pass", "Verified" |
| red-325 / 750 | `#FFBFB7` / `#8E2626` | Error | "Blocked", "fail" |
| tangelo-500 / 100 | `#ED5E2A` / `#F1D5CA` | Orange accent | Compliance floor tag, compliance-5 dots |

## Type

| Role | Deel | Concept |
|---|---|---|
| Body / UI | Inter (`'Inter','Inter Fallback',Arial,Helvetica,sans-serif`), `font-feature-settings: "ss01"` | Inter via Google Fonts, same stack and feature setting |
| Headings | BagossStandardVF (licensed, not redistributable) at weight 500 | Inter 500 with −0.02em tracking, the closest freely available match to the weight and tightness |
| Weights seen | 500 (157×), 400 (102×), 600 (99×) | 400 body, 500 headings, 600 labels |
| Sizes seen | 14, 16, 12, 28, 24, 20, 36, 44 px | 12–15 UI, 18–22 card heads, 34 page H1, 44 hero H1 |
| Letter-spacing | −0.08px / −.005em body | −.005em body |

## Shape and depth

| Token | Deel | Concept |
|---|---|---|
| Radius | `--radius-sm 8px`, `md 12px`, `lg 16px`, `xl 24px`, pills `200px` | Same scale; buttons and chips are pills |
| Card shadow | `0 8px 16px #1b1b1b0a, 0 2px 8px #1b1b1b0a` | Same |
| Lift shadow | `0 4px 8px rgba(0,0,8,.08)` | Hover on loop cards |
| Borders | `rgba(27,27,27,.16)` | `.08` for cards, `.16` for inputs and table heads |

## Components

- **Primary button:** `#1B1B1B` pill, white text, weight 500, hover `#4E4E4E` (matches Deel's "Book a demo").
- **Ghost button:** transparent, 1px `rgba(27,27,27,.16)` border.
- **On dark:** white pill (`btn--light`) and outline-white pill, as on Deel's dark hero.
- **Nav:** text links at 14px/500; the active tab is a filled ink pill.
- **Chips:** 12px/600 pills; colour encodes state, and text always states it too (never colour alone).

## Accessibility notes

- Text on latte and white meets WCAG AA (ink `#1B1B1B` on `#FFFBF4` ≈ 16:1).
- Status chips use dark text on light fills (e.g. `#5C4600` on `#FFE27C`).
- Focus ring: 2px purple-750 outline.
- Respects `prefers-reduced-motion`.
- Works at 390px with no horizontal page scroll (tested).

## What is deliberately *not* copied

- Deel's licensed heading typeface.
- Product screenshots, illustrations or photography.
- Any claim of affiliation: the logo is labelled **unofficial concept**, and the footer and notice say it isn't affiliated with or endorsed by Deel.
