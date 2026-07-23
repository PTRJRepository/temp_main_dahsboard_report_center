# 06 — Long Horizon Roadmap (UI / KPI / Table / UX)

Horizon ini **bukan** komitmen sprint kaku — prioritas bisnis Rebinmas bisa menggeser urutan.  
Status: `NOW` (sudah/partial) · `NEXT` · `LATER` · `VISION`.

---

## Horizon 0 — NOW (baseline terdokumentasi)

- [x] Procurement workspace control tower  
- [x] KPI deck multi-fetch (8 reports)  
- [x] Master valuation + gudang/workshop bars  
- [x] Net flow + total usage hero  
- [x] Movement KPI section  
- [x] Top 5 usage items strip  
- [x] Filter period vs aging labels  
- [x] Filter sync ke InventoryOverview  
- [x] Detail control bar + monthly ringkasan extracts  
- [x] Forest design system `.rc-*`  
- [ ] Full login-less docs screenshots (butuh session manusia)

---

## Horizon 1 — NEXT (1–3 minggu produk)

### KPI deck
1. **Tabs/rails** eksplisit: Valuasi | Masuk | Issue Analysis | Return | Risiko  
2. **Freq/hari** + ActiveIssueDays di summary + chip hero  
3. **PO fill rate %** card  
4. **Return rate** card di section Return  
5. **Top toggle** amount/qty/freq  
6. **Top dept (AccCode)** list  
7. Debounce scopeCode input  
8. Naikkan period options 8 → 18 bulan  

### Detail/table
9. Cap primary KPI monthly ketat ≤6 di semua profile  
10. Collapse duplicate filter chips di viewer monolit  
11. Export honesty chips di toolbar (CSV/Excel/PDF/AI)  
12. Viewer profile extract `lib/reports/inventory/viewer-profiles/*`  

### Quality
13. Pure math tests NetFlow/Freq/FillRate  
14. Implementation log field map API  
15. Unify currency formatting deck → `format.ts`  

---

## Horizon 2 — MID (1–2 bulan)

1. **Composite API** `GET /api/reports/procurement/command-deck`  
2. MoM delta + sparkline 6–12 titik  
3. Lead time PO→GR  
4. Dead stock **value** (bukan hanya count)  
5. Fuel usage mini-rail  
6. Concentration top-10 stock value  
7. Catalog ↔ deck shared filter URL state (`?period=&mc=`)  
8. Performance: cache client short TTL per filter key  
9. A11y audit (keyboard tabs, SR labels)  
10. Playwright smoke: login → procurement → open RPTIN1000015  

---

## Horizon 3 — LONG (kuartal+)

1. Multi-module command decks (HR, FFB, Payroll) **reuse shell**  
2. Role-based KPI visibility (CEO vs gudang vs finance)  
3. Saved views / favorites filter presets  
4. Alerting thresholds (dead stock value > X)  
5. Offline snapshot / print A3 command deck  
6. Design tokens formal (Figma library) mirror CSS vars  
7. Split remaining dual monoliths safely (no big-bang)  
8. Realtime soft refresh (interval + focus) dengan cost control  
9. Bilingual optional EN toggle (copy glossary sudah ada)  
10. Mobile-first compact deck mode  

---

## Horizon 4 — VISION (arah strategis)

- **Single operational glass**: estate + mill side-by-side compare  
- AI narrative **over verified KPI only** (no hallucinated totals)  
- Cross-module story: “pupuk usage → PR → GR → stock cover days”  
- Governance: metric dictionary enforced in CI (unknown KPI id fails build)  

---

## Dependency map

```
Data honesty (summary fields)
  → KPI deck richness
  → Tab Issue Analysis
  → Composite API
  → Trends / alerts

Detail IA cleanup
  → shared ControlBar
  → export honesty
  → profile extract
  → monolit shrink
```

## Risk register (UI)

| Risk | Mitigasi |
|------|----------|
| Terlalu banyak kartu | Hero ≤5 + tabs |
| Dual period confusion | labels + docs + tests |
| Fake net flow vs monthly | label source ad-hoc; later align RPTIN |
| Latency 8 fetch | composite + skeleton + partial |
| AccCode mislabel GL | copy review + dictionary |
| Format money dual system | migrate to format.ts |

## Definition of “UI docs complete” for a release

- [ ] Index updated date  
- [ ] KPI inventaris match `ProcurementKpiStrip`  
- [ ] Flow A–D still valid  
- [ ] Gaps section honest  
- [ ] Long horizon items re-tagged NOW/NEXT  

---

**Next:** `07-SOURCE-OF-TRUTH-AND-GAPS.md`
