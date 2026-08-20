# 13 — Filter Matrix (LIVE)

Satu sumber untuk “filter mana memengaruhi apa”.

---

## 1. Module-level (`moduleFilters` di Workspace)

| Key | UI label | Type | Owned by | Consumed by |
|-----|----------|------|----------|-------------|
| period | Periode usage/receive | YYYY-MM | KPI strip + overview | deck fetches, overview API, drill hrefs |
| movementWindow | Jendela aging movement | all\|1m\|3m\|6m\|12m | KPI + overview | movement summary, overview MC, drill movement |
| groupBy | Analysis Group | enum codes | KPI strip | stock/analysis params (not MovementCategory in group list currently for strip options) |
| scopeCode | Kode Filter | string | KPI strip | stockAnalysis/productType/… |
| itemType | Item Scope | ''\|gudang\|workshop | KPI strip | overview itemType, workshop fetch, catalog tab also sets |
| location | Lokasi | string | KPI strip | location query param |

**Default:** period = current month; movementWindow = all; groupBy = ProductTypeCode (createDefault); itemType empty = 1+4.

---

## 2. Overview-only (local)

| Key | UI | Effect |
|-----|-----|--------|
| movementDefinition.fastMin | Fast >= | category thresholds |
| movementDefinition.slowCount | Slow = | |
| movementDefinition.movingMin/Max | Moving range | |
| refreshKey | Refresh button | refetch |

Tidak di-sync ke KPI strip (sengaja lokal).

---

## 3. Catalog / area kerja

| Control | Effect |
|---------|--------|
| Tab Semua/Gudang/Workshop/Ordering | route group + itemType for embedded catalog |
| source estate/pabrik | whole workspace |
| Catalog internal search/tags | client filter list reports |

---

## 4. Detail monthly (ReportControlBar)

| Control | Clears / sets |
|---------|----------------|
| Actual period month | sets period; clears accYear/accMonth/actualYear/actualMonth raw |
| Analysis group | table/group dimension |
| Movement window | aging window on monthly profile |
| Item type segments | inventory\|gudang\|workshop |
| More filters | manual filter panel (full ReportFilterInput) |

---

## 5. Cross-surface conflicts (watch)

| Conflict | Mitigation LIVE | Masih risiko |
|----------|-----------------|--------------|
| Double period (deck vs overview) | hideScopeControls on overview | user opens inventory standalone |
| Period vs MC window confusion | separate labels | education / glossary |
| itemType tab vs KPI itemType | tab forces catalog; KPI filter separate | can diverge until user aligns |
| groupBy strip vs movement groupBy | movement fetch forces MovementCategory | OK by code |
| Net flow period vs monthly accounting | different formulas | document honesty |

---

## 6. Drill-down param map (typical)

```
?source=
&period=
&location=
&itemType=
&groupBy=
&chartDimension=
&movementWindow=
&stockAnalysis|productType|productCategory|…=
&movementCategory=   // from overview segment
```

---

**Next:** `14-COMPONENT-INVENTORY.md`
