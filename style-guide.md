# Personal website style guide

A calm, considered, editorial aesthetic. Slate teal as primary, warm cream as canvas, with restrained warm accents. Every color earns its place — no decorative color.

## Color palette

| Token | Hex | RGB | Role |
|---|---|---|---|
| `--color-cream` | `#F7F0DE` | 247, 240, 222 | Page background. The canvas. |
| `--color-cream-tint` | `rgba(70, 95, 105, 0.04)` | — | Subtle card/section backgrounds (slate at 4% opacity). Use instead of borders to group content. |
| `--color-slate` | `#46606A` | 70, 96, 106 | Primary brand color. Headings, nav, primary buttons, large surfaces. |
| `--color-slate-soft` | `#5A7A82` | 90, 122, 130 | Secondary slate for tags, less prominent UI. |
| `--color-ink` | `#2C3D45` | 44, 61, 69 | Body text and prominent headings. Never use pure black — it's harsh against cream. |
| `--color-ink-muted` | `#4A5A60` | 74, 90, 96 | Secondary body text, descriptions. |
| `--color-ink-subtle` | `#6A7A80` | 106, 122, 128 | Tertiary text, metadata. |
| `--color-ink-faint` | `#8A969A` | 138, 150, 154 | Dates, very quiet labels. |
| `--color-terracotta` | `#B85A3F` | 184, 90, 63 | Accent. Links, CTAs, anything that needs to pull the eye. Use sparingly. |
| `--color-ochre` | `#C4983F` | 196, 152, 63 | Bridge color. Tags, badges, secondary highlights. Warm without being urgent. |
| `--color-border` | `rgba(70, 95, 105, 0.15)` | — | Hairline dividers. 0.5px width. |

## Color usage rules

- **60/30/10 distribution.** Cream covers ~60% of any page (background and quiet surfaces). Slate covers ~30% (text, headers, large UI). Accents (terracotta + ochre combined) cover ~10% maximum.
- **Terracotta is rationed.** One terracotta element per major section. It's the "look here" color. If everything is terracotta, nothing is.
- **Ochre is for warmth, not emphasis.** Use it where you want a touch of color but no call to action — tags, secondary badges, decorative tiles.
- **Never pure black or pure white.** Cream replaces white. Ink replaces black. Pure values feel jarring against this palette.
- **Borders are usually wrong.** Prefer `--color-cream-tint` backgrounds to group content. Reserve hairline borders for header/footer dividers only.

## Typography

- **Font stack:** A clean sans-serif. System default is fine: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Pair with a serif for long-form essays if desired (e.g. Charter, Iowan Old Style, Georgia).
- **Two weights only:** 400 (regular) and 500 (medium). Never 600 or 700 — they feel heavy against the warm background.
- **Sentence case everywhere.** No Title Case for headings, no ALL CAPS for body. Tiny eyebrow labels (section markers like "RECENT WRITING") are the only exception, and they use letter-spacing 1.5px at 11px size in slate.
- **Sizes:**
  - Hero heading: 32px / weight 500 / line-height 1.25 / letter-spacing -0.3px / color ink
  - Section heading: 18px / weight 500 / color ink
  - Body: 14px / weight 400 / line-height 1.7 / color ink-muted
  - Small / metadata: 11–12px / color ink-subtle
  - Eyebrow label: 11px / weight 400 / letter-spacing 1.5px / uppercase / color slate

## Layout

- **Generous whitespace.** Section padding 36–48px horizontal, 40–56px vertical. Don't crowd.
- **Border radius:** 6px for buttons and small elements, 8px for cards and larger surfaces. Never larger.
- **Hairlines, not heavy borders.** When a divider is necessary, use 0.5px in `--color-border`.
- **No drop shadows, gradients, blurs, or glow effects.** Flat surfaces only. Depth comes from the cream-tint backgrounds, not from shadows.

## Components

### Primary button
- Background: slate
- Text: cream
- Padding: 9px 18px
- Border radius: 6px
- Font size: 12px / weight 500

### Secondary button
- Background: transparent
- Text: slate
- Border: 1px solid slate
- Same padding, radius, and font as primary

### Card
- Background: `--color-cream-tint`
- Border radius: 8px
- Padding: 18px 20px
- No border, no shadow

### Featured project tile
- Background: a single accent color (slate, ochre, or terracotta)
- Text: cream (or cream at 70-85% opacity for secondary text)
- Border radius: 8px
- Padding: 22px 18px

### Tag / badge
- Background: slate, slate-soft, ochre, or terracotta
- Text: cream
- Padding: 3px 9px
- Border radius: 3px (slightly tighter than buttons)
- Font size: 10px / weight 500 / letter-spacing 0.3px

### Link
- Color: terracotta
- No underline by default; underline on hover

## Voice and feel

The site should feel **considered, slow, and human.** Not corporate, not playful, not minimalist-empty. Like a well-designed editorial page or a thoughtful indie studio site.

Reference points: Aesop, Are.na, Stripe Press, The Browser Company, well-designed personal sites of writers and designers.

Avoid: glassmorphism, neumorphism, neon accents, heavy shadows, animated gradients, overly trendy effects.

## Section colors

The site has three main sub-sections, each assigned a core color from the palette. The color appears on the landing page tile for that section and extends as an accent throughout the section's sub-pages.

| Section | Color | Token | Hex |
|---|---|---|---|
| Fantasy blog | Terracotta | `--color-section-fantasy` | `#B85A3F` |
| Data science projects | Ochre | `--color-section-data` | `#C4983F` |
| Tools | Slate | `--color-section-tools` | `#46606A` |

### How section colors are used

On the **landing page**, each section has a colored tile (background = section color, text = cream). The three tiles together form the primary navigation into the site.

On a **section's sub-pages**, the color appears as an accent layer — never as the page background. Cream stays the canvas, ink stays the body text, slate stays the global brand. The section color shows up in:

- The active nav item indicator (underline, dot, or background pill)
- Eyebrow labels above section content (the small letter-spaced labels)
- Post tags and category badges
- Inline links within the section (replacing terracotta as the default link color)
- The "back to home" or "more from this section" affordances
- A thin accent rule above the article title or hero

Use the section color sparingly within sub-pages — it's an accent, not a takeover. Aim for 5–10% color coverage on a given page, same as the global accent rule.

### Special note on Tools

Tools shares its color with the global brand (slate). To keep the Tools section visually distinct from generic site chrome:

- Lean more heavily on cream-tint card backgrounds for grouping content
- Use slate-soft (`#5A7A82`) as a secondary accent within Tools so there's still a color shift between the brand layer and the section layer
- Avoid stacking slate buttons inside slate cards — let the card background do the work

### Cross-linking between sections

When linking from one section to another (e.g., a Fantasy blog post that references a data project), use the destination section's color for the link. This is a small but powerful navigational cue.

## Implementation notes for Claude Code

- Use CSS custom properties for all colors. Define them once in `:root` and reference everywhere.
- Build mobile-first. The aesthetic works at any width.
- Prefer semantic HTML (`<article>`, `<nav>`, `<section>`) over divs.
- For long-form content (essays, blog posts), consider a serif font and a max-width of ~640px for readability.
- Dark mode is optional. If implemented, invert: cream background → deep slate background, ink text → cream text. Keep terracotta and ochre roughly the same (maybe slightly desaturated). Avoid the trap of "just invert everything" — slate becomes the background, not a true dark gray.
