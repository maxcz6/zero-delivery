# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** zero-delivery
**Generated:** 2026-10-26 14:25:14
**Category:** SaaS (General)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#2563EB` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#3B82F6` | `--color-secondary` |
| On Secondary | `#000000` | `--color-on-secondary` |
| Accent/CTA | `#EA580C` | `--color-accent` |
| On Accent/CTA | `#000000` | `--color-on-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#1E293B` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#1E293B` | `--color-card-foreground` |
| Muted | `#E9EFF8` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#E2E8F0` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#2563EB` | `--color-ring` |

**Color Notes:** Trust blue + orange CTA contrast [Accent adjusted from #F97316]

**Color Semantic Tokens:** Define semantic color tokens (primary, secondary, error, surface, on-surface) not raw hex in components
**Color Accessible Pairs:** Foreground/background pairs must meet 4.5:1 (AA) or 7:1 (AAA); use tools to verify (WCAG, MD)
**Color Dark Mode:** Dark mode uses desaturated / lighter tonal variants, not inverted colors; test contrast separately (HIG, MD)
**Color Not Decorative Only:** Functional color (error red, success green) must include icon/text; avoid color-only meaning

### Typography

- **Heading Font:** Plus Jakarta Sans
- **Body Font:** Plus Jakarta Sans
- **Mood:** friendly, modern, saas, clean, approachable, professional
- **Font Scale:** 12 14 16 18 24 32 (consistent type scale)
- **Line-Height:** 1.5-1.75 for body text
- **Weight Hierarchy:** Bold headings (600–700), Regular body (400), Medium labels (500)
- **Line-Length:** Limit to 65-75 characters per line
- **Font Pairing:** Match heading/body font personalities (same family, different weights)
- **Google Fonts:** [Plus Jakarta Sans + Plus Jakarta Sans](https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #EA580C;
  color: #000000;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
  transition: transform 100ms ease;
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #2563EB;
  border: 2px solid #2563EB;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-secondary:hover {
  border-color: #1D4ED8;
}

/* Button States Pattern */
.btn {
  /* Focus state */
  outline: none;
  transition: box-shadow 200ms ease;

  &:focus-visible {
    box-shadow: 0 0 0 3px #2563EB;
  }

  /* Active/pressed state */
  &:active {
    transform: translateY(0);
    transition: transform 100ms ease;
  }

  /* Disabled state */
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

### Cards

```css
.card {
  background: #F8FAFC;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #2563EB;
  outline: none;
  box-shadow: 0 0 0 3px #2563EB20;
}

/* Form Patterns */
.input::placeholder {
  color: #475569;
  opacity: 1;
}

/* Label Pattern: Always use visible label, not placeholder-only */
.input-label {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
  color: #475569;
}

/* Error State */
.input-error {
  border-color: #DC2626;
}

.input-error + .error-message {
  color: #DC2626;
  font-size: 12px;
  margin-top: 4px;
  display: block;
}

/* Helper Text */
.input-helper {
  color: #475569;
  font-size: 12px;
  margin-top: 4px;
  display: block;
}

/* Inline Validation */
.input-success {
  border-color: #059669;
}

.input-success + .success-message {
  color: #059669;
  font-size: 12px;
  margin-top: 4px;
  display: block;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Glassmorphism

**Keywords:** Frosted glass, transparent, blurred background, layered, vibrant background, light source, depth, multi-layer

**Best For:** Modern SaaS, financial dashboards, high-end corporate, lifestyle apps, modal overlays, navigation

**Key Effects:** Backdrop blur (10-20px), subtle border (1px solid rgba white 0.2), light reflection, Z-depth

### Page Pattern

**Pattern Name:** Hero + Features + CTA

- **Conversion Strategy:** Deep CTA placement. For CTA label text, verify at least 4.5:1 against the button fill; use 7:1 only when the product explicitly targets AAA normal-text contrast. Keep focus and component boundaries independently visible. Disable hero parallax under reduced motion and render its static final state.
- **CTA Placement:** Hero (sticky) + Bottom
- **Section Order:** Hero with headline/image > Value prop > Key features (3-5) > CTA section > Footer

---

## Anti-Patterns (Do NOT Use)

- ❌ Excessive animation
- ❌ Dark mode by default

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
- [ ] Touch targets minimum 44px (iOS) / 48px (Android) for clickable elements
- [ ] Visible focus indicator (2-4px focus ring) on interactive elements
- [ ] Error messages displayed near the related field with clear description
- [ ] Success feedback shown after completed actions
- [ ] Helper text available for complex inputs (not placeholder-only labels)
- [ ] Inline validation on blur (not keystroke)
- [ ] Disabled states are visually clear (reduced opacity 0.38-0.5) and non-interactive
- [ ] Color is not the only indicator of meaning (add icon/text for functional colors)
- [ ] Modal/drawer scrim measured against real background; foreground legibility preserved
- [ ] Both light and dark mode contrast tested independently (>= 4.5:1 for normal text)
- [ ] Safe areas respected for headers, tab bars, and bottom CTA bars
- [ ] Scroll content not hidden behind fixed/sticky bars
- [ ] Stack/nesting patterns consistent across navigation (no mixed Tab + Sidebar + Bottom Nav)
- [ ] progressive-disclosure used for complex options (don't overwhelm upfront)
- [ ] Auto-rotating content has pause/stop controls and stops on focus or reduced motion
- [ ] Authentication allows password managers and paste, with non-cognitive alternative
- [ ] Forms retain inline field errors after submit; multi-error forms focus error summary
- [ ] Shadow depth uses design tokens (--shadow-sm, --shadow-md, --shadow-lg, --shadow-xl)
- [ ] Spacing uses design tokens (--space-xs through --space-3dl) consistent rhythm
- [ ] Long-form text measure remains readable on larger devices (no edge-to-edge paragraphs)
- [ ] Section spacing hierarchy maintained (16/24/32/48px tiers by hierarchy)
