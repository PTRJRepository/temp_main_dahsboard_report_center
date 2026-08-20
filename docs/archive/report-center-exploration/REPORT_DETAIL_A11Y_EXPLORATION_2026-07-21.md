# Report Detail — Accessibility (a11y) Exploration

**Date:** 2026-07-21  
**Scope:** Inventory report detail (`ReportViewerClient`) + RC shell tokens.  
**Not a full WCAG audit** — inventory of current patterns and redesign requirements.

---

## 1. What already exists (good seeds)

| Pattern | Where |
| --- | --- |
| `aria-label` on favorite / filter chips / clear all | banner + chip bars |
| `role="region"` + `aria-label="Active filters"` | sticky chips |
| `aria-expanded` on monthly secondary toggle | Ringkasan |
| Clickable KPI cards: `role="button"` + `tabIndex={0}` + Enter/Space | global cards |
| `focus-visible:outline` on several buttons | banner / chips |
| SQL chip `focus-visible:opacity-100` | even when hover-hidden |
| SQL modal `role="dialog"` `aria-modal` | ~6417 |
| Virtual spacer rows `aria-hidden` | table |
| Loading skeleton `aria-hidden` | table loading |
| Icons often `aria-hidden` | good |
| CSS focus tokens on command bar / kpi strip | `globals.css` |
| `prefers-reduced-motion` for some animations | globals |

---

## 2. Gaps (why dense UI also fails a11y)

| Gap | Impact |
| --- | --- |
| No page-level `h1` landmark strategy shared with shell | screen reader orientation |
| Sticky Ringkasan not a named landmark/region | “where am I” |
| Many icon-only / text-xs controls without consistent names | SQL, Columns summary, overflow |
| Table sort headers are buttons but no `aria-sort` | sort state unclear |
| Virtualized table: only visible rows in a11y tree | expected; need live region for row counts |
| Fullscreen table: focus not trapped / not moved to Exit | keyboard users lost |
| Dialog SQL: verify focus trap + Escape | partial |
| Double chip bars = duplicate controls in tab order | noise |
| Color-only meaning (rose issued, lime closing) | need text labels (already partial) |
| Contrast: faint white/35 labels on dark | check AA for small caps labels |
| Motion on shell `framer-motion` main | respect reduced motion globally |
| Custom `div role=button` KPIs vs real `<button>` | prefer real buttons |
| No skip link “Loncat ke tabel” | long page |
| Export/PDF honesty not announced | SR users may not know sample |

---

## 3. Target a11y contract (redesign)

### 3.1 Landmarks

```
banner (topbar)
navigation (sidebar)
main
  header (report title h1)
  region "Kontrol laporan" (control bar)
  region "Filter aktif" (chips)
  tablist "Ruang kerja"
  tabpanel Ringkasan | Analisis | Detail | Audit
```

### 3.2 Keyboard

| Action | Key |
| --- | --- |
| Move tabs | Arrow L/R on tablist |
| Activate control | Tab / Enter / Space |
| Remove chip | focus chip, Enter/Space or Delete |
| Sort column | Enter on header button; announce via `aria-sort` |
| Exit fullscreen table | Escape + visible Exit focused on enter |
| Close SQL dialog | Escape; return focus to opener |

### 3.3 Live regions

- Filter apply: polite “Filter diterapkan: …”  
- Stream progress: polite “Memuat baris 1.200 / 12.000”  
- Export start/finish: polite  

### 3.4 Table

- `scope="col"` on headers  
- Sticky identity columns remain in tab order logically  
- Row expand: `aria-expanded` on row or control  
- Group header: button with expanded state  

### 3.5 Visual

- Focus ring 2px accent on all interactive  
- Do not rely on color alone for Issued vs Closing  
- Reduced motion: disable translate-y hovers / framer when preferred  

---

## 4. Implementation checklist (when coding UI)

- [ ] One `h1` report title  
- [ ] Tablist pattern for workspaces  
- [ ] Replace div-buttons with button where possible  
- [ ] `aria-sort` on active column  
- [ ] Focus trap fullscreen + dialog  
- [ ] Skip link to `#report-data-table`  
- [ ] Live region for stream + filters  
- [ ] Contrast pass on label/value pairs  
- [ ] Keyboard-only path: open monthly → change period → remove chip → sort → export menu  

---

## 5. Manual test script (no automated suite yet)

1. Tab from Topbar through ControlBar to KPI to tabs to table  
2. No focus loss into `opacity-0` SQL until focused  
3. Screen reader (Narrator): title, period, 6 KPI labels, chip list  
4. Zoom 200%: control bar wraps, no clip primary values  
5. High contrast mode smoke (Windows)  

---

## 6. Agent rule

A11y is part of **Definition of Done** in master prompt — not a polish afterthought. Prefer semantic HTML over ARIA soup.

---

**End a11y exploration.**
