You are CODEX — the AGI Architect for PT Rebinmas Jaya.

PROJECT: D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama
Server: http://localhost:3002 (running)

TASKS:
1. Read docs/WAVE6-DISPATCH.md for full context
2. Read app/page.tsx (Landing Page - 178L server component)
3. Read app/reports-center/page.tsx (Dashboard - 120L with IntelligenceWidget)
4. Read app/reports-center/layout.tsx (Sidebar+Topbar shell)
5. Read components/layout/Sidebar.tsx (287L full sidebar)
6. Read components/dashboard/ModuleCard.tsx
7. Read components/dashboard/HeroBanner.tsx

Then WRITE a detailed design review to: docs/CODEX-DESIGN-REVIEW.md

Your review must be SPECIFIC and include:

## 1. LANDING PAGE (/)
- Hero design quality
- Stats cards (4 stats layout)
- Feature grid (8 items)
- Module list (9 modules)
- Color scheme consistency
- Polish items needed
- Specific Tailwind fixes

## 2. REPORT CENTER DASHBOARD (/reports-center)
- Sidebar design quality (287L Sidebar component)
  - UTAMA group: Dashboard, All Reports, Favorites, Recent
  - MODUL group: 9 module links with count badges
  - ADMINISTRASI group: Export History, Settings
  - Collapsible behavior
- Topbar: search input, notification bell, user avatar
- Module Card grid: 9 cards in responsive grid
  - Badge design (module counts)
  - Lock status (coming soon) indicators
  - Hover effects
- AI Recommendations widget (IntelligenceWidget)
  - Confidence bars
  - Reason type badges (time_based, updated, similar, anomaly, due)
  - Expand/collapse
- Bottom panels: Favorites, Recent, System Info

## 3. VISUAL QUALITY ASSESSMENT
Rate each section: Excellent / Good / Needs Work / Broken
Give specific examples with Tailwind class names

## 4. COLOR SCHEME EVALUATION
- Navy (#071426) for sidebar
- Green (#167A3A) for accents
- Are they used consistently?
- What needs improvement?

## 5. CSS ISSUES TO FIX
List all broken Tailwind classes found:
- e.g., `bg-white/8` → should be `bg-white/80`
- e.g., `marginLeft: 260` → should be Tailwind `ml-64`
- Wrong class names, deprecated variants

## 6. POLISH ITEMS
Priority list of UI/UX improvements needed:
1. (highest priority)
2. ...
10+ (lowest priority)

Include specific Tailwind code examples for each fix.

Be CRITICAL — this is a CEO-level product. Nothing should look amateur.
