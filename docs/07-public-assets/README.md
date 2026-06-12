# Public Assets - Styling & UI Component Details

> **Lokasi File:** `D:/Gawean Rebinmas/Main Dashboard/docs/07-public-assets/README.md`
> **Last Updated:** 2026-06-10
> **Scope:** Deep-dive styling, CSS components, color system

---

## Overview

Direktori `public/` berisi semua asset frontend:
```
public/
├── index.html    # SPA entry point (5,474 chars)
├── css/
│   └── style.css # Main stylesheet (12,472 chars)
└── js/
    └── app.js    # SPA application logic (9,994 chars)
```

---

## Color System

### Primary Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--primary-bg` | `#071426` | Main background (Dark Navy) |
| `--secondary-bg` | `#0D2647` | Cards, panels |
| `--accent` | `#167A3A` | Buttons, highlights, success (Green) |
| `--accent-hover` | `#1E8F47` | Hover state for accent |
| `--text-color` | `#FFFFFF` | Primary text |
| `--text-muted` | `#8BA4BC` | Secondary text |
| `--border-color` | `#1A3A5C` | Borders, dividers |

### Semantic Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Error | `#DC2626` | Error states |
| Warning | `#D97706` | Warning states |
| Success | `#167A3A` | Success states |
| Info | `#2563EB` | Info states |

---

## CSS Architecture

### CSS Variables
All colors and spacing defined as CSS custom properties for easy theming:
```css
:root {
  --primary-bg: #071426;
  --secondary-bg: #0D2647;
  --accent: #167A3A;
  --accent-hover: #1E8F47;
  --text-color: #FFFFFF;
  --text-muted: #8BA4BC;
  --border-color: #1A3A5C;
  --success: #167A3A;
  --error: #DC2626;
  --warning: #D97706;
  --info: #2563EB;
}
```

### Layout System
- **Flexbox** for component layouts
- **CSS Grid** for dashboard tile layouts (Windows tile design)
- **CSS Custom Properties** for consistent spacing

### Design Patterns
1. **Windows Tile Design** — Grid layout dengan rounded corners, shadows
2. **Glassmorphism** — Semi-transparent backgrounds dengan backdrop-filter blur
3. **Card-based UI** — Consistent card styling dengan hover effects
4. **Dark Theme** — Full dark theme, no light mode

---

## Component Styles

### Button
- Background: `--accent` (#167A3A)
- Hover: `--accent-hover` (#1E8F47)
- Text: White, bold
- Border-radius: rounded corners
- Transitions: smooth hover/active states

### Cards/Tiles
- Background: `--secondary-bg` (#0D2647)
- Border: 1px solid `--border-color`
- Border-radius: 8-12px
- Box-shadow for depth
- Hover: subtle lift effect

### Tables
- Striped rows (alternating background)
- Header: darker background
- Hover highlight on rows
- Responsive scroll

### Forms
- Dark input backgrounds
- Focus ring dengan accent color
- Consistent padding

---

## Related Documentation

- **Frontend Overview:** `docs/06-routes-api/README.md`
- **Project Overview:** `docs/01-project-overview/README.md`

---

*Document ini bagian dari dokumentasi project Main Dashboard PT Rebinmas Jaya*
