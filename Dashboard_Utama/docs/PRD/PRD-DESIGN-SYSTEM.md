# PRD — Design System
**Document Version:** 1.0.0
**Project:** Dashboard_Utama — Report Center & Inventory Module
**Last Updated:** 2026-05-17
**Authors:** Design System Sub-Agent

---

## 1. Overview & Design Philosophy

This Design System establishes the visual and interactive grammar for Dashboard_Utama. It prioritizes **data clarity**, **operational density**, and **responsive trust** — built for Indonesian-language enterprise users who need to absorb KPI snapshots and inventory states at a glance. Every token, type rule, and spacing decision serves readability under real-world screen conditions.

**Core Principles:**
- **Hierarchical Clarity** — The eye must always know where it is in the data hierarchy.
- **Semantic Color** — Color carries meaning, not decoration.
- **Touch & Click Parity** — Controls must be operable by both mouse and touch.
- **Density Tunable** — Compact and relaxed modes share the same tokens.

---

## 2. Color System

### 2.1 Primitive Palette (Base Tokens)

| Token Name | Hex | Usage |
|---|---|---|
| `color.primitive.blue.500` | `#3B82F6` | Primary actions, links, active states |
| `color.primitive.blue.600` | `#2563EB` | Hover on primary |
| `color.primitive.blue.700` | `#1D4ED8` | Pressed/active primary |
| `color.primitive.slate.50`  | `#F8FAFC` | Page background |
| `color.primitive.slate.100` | `#F1F5F9` | Card/panel backgrounds |
| `color.primitive.slate.200` | `#E2E8F0` | Borders, dividers |
| `color.primitive.slate.300` | `#CBD5E1` | Disabled borders |
| `color.primitive.slate.400` | `#94A3B8` | Placeholder text, icons |
| `color.primitive.slate.500` | `#64748B` | Secondary text |
| `color.primitive.slate.600` | `#475569` | Body text |
| `color.primitive.slate.700` | `#334155` | Headings |
| `color.primitive.slate.800` | `#1E293B` | Dark UI panels |
| `color.primitive.slate.900` | `#0F172A` | Dark mode background |
| `color.primitive.emerald.500` | `#10B981` | Success, stock-adequate |
| `color.primitive.emerald.600` | `#059669` | Success hover |
| `color.primitive.amber.500`  | `#F59E0B` | Warning, low-stock threshold |
| `color.primitive.amber.600`  | `#D97706` | Warning hover |
| `color.primitive.red.500`   | `#EF4444` | Error, critical stock, out-of-stock |
| `color.primitive.red.600`    | `#DC2626` | Error hover |
| `color.primitive.purple.500`| `#8B5CF6` | AI/insight accents |
| `color.primitive.cyan.500`   | `#06B6D4` | Data visualization accent |
| `color.primitive.white`      | `#FFFFFF` | Card surfaces, inputs |
| `color.primitive.black`      | `#000000` | Text on light |

### 2.2 Semantic Color Tokens

| Token Name | Value | Usage |
|---|---|---|
| `color.surface.page`        | `slate.50` | Full-page background |
| `color.surface.card`        | `white`    | Card and panel fill |
| `color.surface.elevated`    | `white`    | Dropdowns, modals |
| `color.border.default`      | `slate.200` | Standard borders |
| `color.border.focus`        | `blue.500`  | Focus rings, active borders |
| `color.text.primary`        | `slate.700` | Headings, labels |
| `color.text.secondary`      | `slate.500` | Subtitles, captions |
| `color.text.disabled`       | `slate.300` | Disabled labels |
| `color.text.inverse`        | `white`     | Text on colored backgrounds |
| `color.action.primary`      | `blue.500`  | Primary button fill |
| `color.action.primary.hover`| `blue.600`  | Primary button hover |
| `color.action.danger`       | `red.500`   | Destructive actions |
| `color.status.success`      | `emerald.500` | Success states |
| `color.status.warning`      | `amber.500`   | Warning states |
| `color.status.error`        | `red.500`     | Error states |
| `color.status.info`         | `blue.500`    | Info/neutral badges |
| `color.kpi.positive`        | `emerald.500` | KPI increase |
| `color.kpi.negative`        | `red.500`     | KPI decrease |
| `color.kpi.neutral`         | `slate.400`   | KPI unchanged |

### 2.3 Dark Mode Overrides

| Token Name | Hex | Usage |
|---|---|---|
| `color.dm.surface.page`  | `#0F172A` | Dark mode page bg |
| `color.dm.surface.card`  | `#1E293B` | Dark mode card bg |
| `color.dm.border`        | `#334155` | Dark mode borders |
| `color.dm.text.primary`  | `#F1F5F9` | Dark mode headings |
| `color.dm.text.secondary`| `#94A3B8` | Dark mode body |

---

## 3. Typography

### 3.1 Font Stack

```
font.family.sans: 'Inter', 'Noto Sans', system-ui, -apple-system, sans-serif
font.family.mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace
font.family.display: 'Plus Jakarta Sans', 'Inter', sans-serif
```

> **Note:** Inter is the primary UI font. Plus Jakarta Sans is reserved for marketing/highlight headings. JetBrains Mono is used for code, IDs, and numeric data.

### 3.2 Type Scale

| Token | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| `type.display-xl` | 48px | 1.1 | 800 | Hero KPI numbers |
| `type.display-lg` | 36px | 1.15 | 700 | Section KPI numbers |
| `type.display-md` | 28px | 1.2 | 700 | Card KPI headers |
| `type.heading-xl` | 24px | 1.3 | 700 | Page titles |
| `type.heading-lg` | 20px | 1.35 | 600 | Section headers |
| `type.heading-md` | 16px | 1.4 | 600 | Card titles |
| `type.body-lg` | 16px | 1.6 | 400 | Body text |
| `type.body-md` | 14px | 1.6 | 400 | Standard UI text |
| `type.body-sm` | 13px | 1.5 | 400 | Secondary labels |
| `type.caption` | 12px | 1.4 | 500 | Badges, tags, captions |
| `type.micro` | 11px | 1.3 | 600 | Data table headers, overlines |

### 3.3 Numeric Typography

Monospace numerals are used for all data displays to prevent layout shift when numbers update.

```css
font-feature-settings: "tnum" 1, "zero" 1;
```

All KPI values, inventory quantities, and financial figures use `font-family: 'JetBrains Mono'`.

---

## 4. Spacing System

### 4.1 Base Unit

All spacing derives from a **4px base unit**.

```
space.1  = 4px
space.2  = 8px
space.3  = 12px
space.4  = 16px
space.6  = 24px
space.8  = 32px
space.10 = 40px
space.12 = 48px
space.16 = 64px
space.20 = 80px
```

### 4.2 Spacing Tokens & Usage

| Token | Value | Usage |
|---|---|---|
| `space.inline-xs`  | 4px  | Icon-to-label gap (inline) |
| `space.inline-sm`  | 8px  | Badge padding-x, icon gap in buttons |
| `space.inline-md`  | 12px | Standard inline element gap |
| `space.stack-xs`   | 4px  | Tight line-height stack (badges) |
| `space.stack-sm`   | 8px  | Icon above-label, compact stacks |
| `space.stack-md`   | 12px | Standard stack between related items |
| `space.stack-lg`   | 16px | Card internal padding |
| `space.stack-xl`   | 24px | Section gaps between cards |
| `space.section`    | 32px | Major section separation |
| `space.page-x`     | 24px | Page horizontal padding (desktop) |
| `space.page-x`     | 16px | Page horizontal padding (mobile) |
| `space.card-gap`   | 16px | Gap between grid cards |

---

## 5. Elevation & Shadow System

| Token | Value | Usage |
|---|---|---|
| `shadow.none`    | none | Flat elements |
| `shadow.sm`      | `0 1px 2px rgba(0,0,0,0.05)` | Subtle card lift |
| `shadow.md`      | `0 4px 6px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.06)` | Cards at rest |
| `shadow.lg`      | `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` | Hovered cards |
| `shadow.xl`      | `0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.06)` | Modals, dropdowns |
| `shadow.inner`   | `inset 0 1px 3px rgba(0,0,0,0.08)` | Input fields |

---

## 6. Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius.none` | 0px | Sharp data elements |
| `radius.sm`   | 4px | Inputs, small badges |
| `radius.md`   | 8px | Cards, buttons |
| `radius.lg`   | 12px | Modals, large panels |
| `radius.xl`   | 16px | Hero sections |
| `radius.full` | 9999px | Pills, avatars, circular buttons |

---

## 7. Motion & Animation

### 7.1 Timing Tokens

| Token | Value | Usage |
|---|---|---|
| `motion.instant` | 0ms   | Immediate feedback |
| `motion.fast`    | 100ms | Hover state changes |
| `motion.base`    | 200ms | Standard transitions |
| `motion.slow`    | 300ms | Page transitions, panel opens |
| `motion.slower`  | 500ms | Chart animations, data loads |

### 7.2 Easing Curves

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);   /* Natural deceleration */
--ease-in:     cubic-bezier(0.7, 0, 0.84, 0);   /* Natural acceleration */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1); /* Smooth symmetric */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy overshoot */
```

### 7.3 Animation Patterns

| Pattern | Description |
|---|---|
| **Fade In** | `opacity: 0 → 1`, 200ms ease-out — used for card appearance |
| **Slide Up** | `translateY(8px) → translateY(0)`, 200ms ease-out — used for dropdown/modal open |
| **Scale Pop** | `scale(0.95) → scale(1)`, 200ms ease-spring — used for button press feedback |
| **Number Roll** | Digit-by-digit count-up animation for KPI values, 500ms ease-out |
| **Skeleton Pulse** | `opacity: 0.6 → 1`, 1.4s ease-in-out infinite — loading states |
| **Stagger** | 50ms delay between sequential card renders |

---

## 8. Data Visualization Palette

Used for charts, progress bars, and KPI sparklines.

```
chart.1 = #3B82F6  (blue)
chart.2 = #10B981  (emerald)
chart.3 = #F59E0B  (amber)
chart.4 = #EF4444  (red)
chart.5 = #8B5CF6  (purple)
chart.6 = #06B6D4  (cyan)
chart.7 = #F97316  (orange)
chart.8 = #EC4899  (pink)
```

---

## 9. Grid & Layout

### 9.1 Grid Tokens

| Token | Value |
|---|---|
| `grid.gutter` | 24px |
| `grid.margin` | 24px (desktop) / 16px (mobile) |
| `grid.max-width` | 1440px |
| `grid.breakpoint.sm` | 640px |
| `grid.breakpoint.md` | 768px |
| `grid.breakpoint.lg` | 1024px |
| `grid.breakpoint.xl` | 1280px |

### 9.2 Responsive Column Strategy

| Viewport | Columns | Card Behavior |
|---|---|---|
| Mobile (<640px) | 1 | Full-width stacked cards |
| Tablet (640–1023px) | 2 | 2-column grid |
| Desktop (1024–1279px) | 3 | 3-column KPI grid, 2-col detail |
| Wide (≥1280px) | 4 | 4-column KPI grid, 3-col detail |

---

## 10. Icon System

| Token | Value |
|---|---|
| `icon.size.xs` | 14px |
| `icon.size.sm` | 16px |
| `icon.size.md` | 20px |
| `icon.size.lg` | 24px |
| `icon.size.xl` | 32px |
| `icon.stroke` | 1.75px (Lucide icon standard) |
| `icon.color.default` | `slate.500` |
| `icon.color.active` | `slate.700` |
| `icon.color.muted` | `slate.300` |

---

## 11. Accessibility

| Requirement | Standard |
|---|---|
| Color contrast | WCAG AA minimum (4.5:1 for body, 3:1 for large text) |
| Focus indicator | 2px blue ring, 2px offset — never removed |
| Touch target | Minimum 44×44px on all interactive elements |
| Reduced motion | Respect `prefers-reduced-motion` — disable number-roll, stagger |
| Screen reader | All icons have `aria-label`; all badges have `role` and `aria-label` |
| Color-blind safety | Never convey state via color alone — always pair with icon or label |

---

## 12. Component File Naming Convention

All component files follow this convention:

```
ComponentName/
├── ComponentName.tsx          # Main component
├── ComponentName.props.ts    # TypeScript interfaces
├── ComponentName.styles.ts   # Style constants/tokens
├── ComponentName.test.tsx    # Unit tests
└── ComponentName.stories.tsx  # Storybook stories
```

---

## 13. Version History

| Version | Date | Author | Notes |
|---|---|---|---|
| 1.0.0 | 2026-05-17 | Design System Sub-Agent | Initial PRD release |

---

*End of PRD-DESIGN-SYSTEM.md*
