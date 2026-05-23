# MCP: IN Lookup Tables Deep-Dive
**Generated:** 2026-05-16 11:45 | **Estate:** SERVER_PROFILE_1 (10.0.0.110) | **Mill:** SERVER_PROFILE_3 (103.127.66.32) | **DB:** db_ptrj_mill | **Store:** MCP

---

## Connection Details

Both Estate and Mill query `db_ptrj_mill` on SQL Server via the SQL Gateway:
```
Base URL  : http://localhost:8001/v1/query
API Key   : 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6
Database  : db_ptrj_mill
```

---

## Row Counts Summary

| Table           | Rows | SP1 (Estate) | SP3 (Mill) | Diff |
|-----------------|-----:|-------------:|-----------:|-----:|
| IN_PRODTYPE     |   52 |           52 |         52 |    0 |
| IN_PRODCAT      |    9 |            9 |          9 |    0 |
| IN_PRODMAT      |   25 |           25 |         25 |    0 |
| IN_PRODBRAND    |    9 |            9 |          9 |    0 |
| IN_PRODMODEL    |    5 |            5 |          5 |    0 |
| IN_STOCKANALYSIS|    4 |            4 |          4 |    0 |

**All 6 lookup tables are byte-identical between SP1 and SP3.** Reference count differences arise purely from IN_ITEMCODE row-count delta (SP1: 11,654 vs SP3: 12,058, diff=404 new Mill-only rows).

---

## Common Schema (All 6 Tables)

All tables share the same 6-column structure:

| # | Column      | Type       | Null? | Width | Interpretation                                                           |
|---|-------------|------------|-------|-------|-------------------------------------------------------------------------|
| 1 | PK (code)   | char       | NO    | 8     | Primary key. ProdTypeCode / ProdCatCode / ProdMatCode / ProdBrandCode / ProdModelCode / StockAnalysisCode |
| 2 | Description | nchar      | YES   | 128   | Human-readable name/label. Space-padded to 128 chars.                   |
| 3 | Status      | char       | YES   | 2     | `'1 '` = active, `'2 '` = inactive. Always RTRIM() before comparing.    |
| 4 | CreateDate  | datetime   | YES   |       | Record creation timestamp (UTC).                                         |
| 5 | UpdateDate  | datetime   | YES   |       | Last modification timestamp (UTC).                                       |
| 6 | UpdateID    | char       | YES   | 20    | User ID who last updated the record.                                     |

**Note:** All char(N) fields are right-padded with spaces. Blank-looking values may be:
- Truly NULL (database NULL)
- Empty string `''` (zero-length, not NULL)
- Space-padded `''` (128 spaces, nchar blank)

Always use `RTRIM()` for display and `IS NULL` / `IS NOT NULL` for null checks.

**All tables were created by user `itech` on 2019-04-03** (initial system setup). Later additions by `yencun` and `acc002`.

---

## 1. IN_PRODTYPE — Product Type / Classification Code

**Purpose:** Top-level item categorization. Used by `IN_ITEMCODE.ProdTypeCode`. Most granular and most-used classification.

**PK:** ProdTypeCode (char 8)

### All 52 Codes

| Code       | Description                              | Status | Created    | By     | SP1 Refs | SP3 Refs | Diff |
|------------|------------------------------------------|--------|------------|--------:|---------:|---------:|-----:|
| ALLMAT     | ALL MATERS                               | 1      | 2019-04-03 | itech  |       75 |       84 |    9 |
| BEAR       | BEARINGS                                 | 1      | 2019-04-03 | itech  |      220 |      220 |    0 |
| BENSIN     | PETROL                                   | 1      | 2019-04-03 | itech  |        1 |        1 |    0 |
| BLSTA      | BOILER STATION                           | 1      | 2019-04-03 | itech  |       56 |       56 |    0 |
| BOILWTR    | BOILER WATER TREATMENT                   | 1      | 2019-04-03 | itech  |        3 |        3 |    0 |
| BOUT       | BOLTS & NUTS                             | 1      | 2019-04-03 | itech  |      238 |      248 |   10 |
| BULGAR     | BULBS & LIGHTING ACCESSORIES            | 1      | 2019-04-03 | itech  |       11 |       11 |    0 |
| CABAR      | CABLES & ACCESSORIES                    | 1      | 2019-04-03 | itech  |       11 |       11 |    0 |
| CHEM-O     | CHEMICAL OTHERS                         | 1      | 2019-04-03 | itech  |       57 |       57 |    0 |
| CONEL      | CONVEYOR / ELEVATOR                      | 1      | 2019-04-03 | itech  |       58 |       58 |    0 |
| CONSUM     | W/S CONSUMABLES                          | 1      | 2019-04-03 | itech  |        5 |        5 |    0 |
| DC         | DIRECT CHARGES                           | 1      | 2019-04-03 | itech  |    3,832 |    3,832 |    0 |
| DEPERI     | DEPERICARPER                             | 1      | 2019-04-03 | itech  |       15 |       15 |    0 |
| DIGES      | DIGESTION                                | 1      | 2019-04-03 | itech  |       25 |       25 |    0 |
| ELDES      | ELECTRODES                               | 1      | 2019-04-03 | itech  |       46 |       48 |    2 |
| ELEC-MCB   | MCB                                      | 1      | 2019-04-03 | itech  |        0 |        0 |    0 |
| ELEC-O     | ELECTRICAL OTHERS                        | 1      | 2019-04-03 | itech  |    1,007 |    1,023 |   16 |
| ELEC-SPR   | ELECTROMOTORS SPARE                      | 1      | 2019-04-03 | itech  |      714 |      717 |    3 |
| ELFIT      | ELECTRICAL FITTNG                        | 1      | 2019-04-03 | itech  |       70 |       72 |    2 |
| FUSE       | FUSE                                     | 1      | 2019-04-03 | itech  |        0 |        0 |    0 |
| FXCOUP     | FLEXIBLE COUPLING                        | 1      | 2019-04-03 | itech  |       17 |       17 |    0 |
| GASPACK    | GASKETS / PACKING                        | 1      | 2019-04-03 | itech  |      116 |      116 |    0 |
| GEN-O      | GENERAL ENGINEERING HARDWARE OTHERS     | 1      | 2019-04-03 | itech  |    1,437 |    1,500 |   63 |
| GRS        | GREASE                                   | 1      | 2019-04-03 | itech  |       44 |       44 |    0 |
| INCEBH     | INCENARATOR/EMPTY BUNCH HOPPER           | 1      | 2019-04-03 | itech  |        1 |        1 |    0 |
| LRAMP      | LOADING RAMP                             | 1      | 2019-04-03 | itech  |        0 |        0 |    0 |
| LUBR       | LUBRICANT                                | 1      | 2019-04-03 | itech  |       25 |       25 |    0 |
| MOTAR      | MOTORS & ACCESSORIES                     | 1      | 2019-04-03 | itech  |       68 |       68 |    0 |
| NELREC     | KERNEL RECOVERY PLANT                    | 1      | 2019-04-03 | itech  |        7 |        7 |    0 |
| OROMIES    | OIL ROOM MACHINERIES                     | 1      | 2019-04-03 | itech  |       11 |       11 |    0 |
| OSRING     | OIL SEAL, O-RINGS                        | 1      | 2019-04-03 | itech  |      171 |      171 |    0 |
| PITING     | PIPES & FITTING                          | 1      | 2019-04-03 | itech  |      308 |      319 |   11 |
| PNEU       | PNEUMATIC/HYDRAULIC FITTINGS             | 1      | 2019-04-03 | itech  |       14 |       14 |    0 |
| PRESS      | PRESSING                                 | 1      | 2019-04-03 | itech  |      114 |      114 |    0 |
| PULE       | PULLEYS                                  | 1      | 2019-04-03 | itech  |       45 |       45 |    0 |
| PUMSP      | PUMP SPARES                              | 1      | 2019-04-03 | itech  |      126 |      126 |    0 |
| PWSTA      | POWER STATION                            | 1      | 2019-04-03 | itech  |       19 |       19 |    0 |
| RAWTR      | RAW WATER TREATMENT                      | 1      | 2019-04-03 | itech  |        0 |        0 |    0 |
| REC        | Recondisi                                | **2**  | 2019-08-15 | yencun |        0 |        0 |    0 |
| SOLAR      | DIESOLINE                                | 1      | 2019-04-03 | itech  |        0 |        0 |    0 |
| STARCOMP   | STARTERS COMPONENTS                      | 1      | 2019-04-03 | itech  |        0 |        0 |    0 |
| STERIL     | STERILISATION                            | 1      | 2019-04-03 | itech  |       27 |       31 |    4 |
| STMAT      | STEEL MATERIALS                          | 1      | 2019-04-03 | itech  |       43 |       47 |    4 |
| STN-PBS    | PREBREAKER                               | 1      | 2020-12-22 | acc002 |        3 |        3 |    0 |
| SUND       | SUNDRY STORES                            | 1      | 2019-04-03 | itech  |    1,214 |    1,378 |  164 |
| THRES      | TRHESHING                                | 1      | 2019-04-03 | itech  |        1 |        1 |    0 |
| TIPLER     | TIPPLER                                  | 1      | 2019-04-03 | itech  |        0 |        0 |    0 |
| TRANCAIN   | TRANSMISSION CHAIN/SPROCKET              | 1      | 2019-04-03 | itech  |      198 |      199 |    1 |
| VALPIT     | VALVES / FITTING                         | 1      | 2019-04-03 | itech  |      198 |      202 |    4 |
| VEEBEL     | VEE BELTS                                | 1      | 2019-04-03 | itech  |      105 |      109 |    4 |
| VSPARE     | VEHICLES SPARES                          | 1      | 2019-04-03 | itech  |      855 |      874 |   19 |
| WEIGH      | Untuk Timbangan                          | 1      | 2023-08-01 | yencun |        3 |        3 |    0 |

### Status Summary
- **Active (Status='1'):** 51 codes
- **Inactive (Status='2'):** 1 code — REC (Recondisi)

### Codes with Zero References (SP1 & SP3)
`ELEC-MCB`, `FUSE`, `LRAMP`, `RAWTR`, `REC`, `SOLAR`, `STARCOMP`, `TIPLER`

### Top 10 by Reference Count (SP1)
`DC (3,832) > GEN-O (1,437) > SUND (1,214) > ELEC-O (1,007) > VSPARE (855) > ELEC-SPR (714) > PITING (308) > BOUT (248) > BEAR (220) > VALPIT (202)`

---

## 2. IN_PRODCAT — Product Category

**Purpose:** Second-level item classification. Used by `IN_ITEMCODE.ProdCatCode`.

**PK:** ProdCatCode (char 8)

### All 9 Codes

| Code | Description                     | Status | Created    | By    | SP1 Refs | SP3 Refs | Diff |
|------|---------------------------------|--------|------------|-------|---------:|---------:|-----:|
| C    | CHEMICAL                        | 1      | 2019-04-03 | itech |       58 |       58 |    0 |
| E    | ELECTRICAL                      | 1      | 2019-04-03 | itech |    1,053 |    1,063 |   10 |
| F    | FUEL                            | 1      | 2019-04-03 | itech |        3 |        3 |    0 |
| G    | GENERAL ENGINEERING HARDWARE    | 1      | 2019-04-03 | itech |    2,926 |    3,021 |   95 |
| L    | LUBRICANT AND OIL               | 1      | 2019-04-03 | itech |       94 |       94 |    0 |
| LLN  | LAINNYA (Others)                | 1      | 2019-04-03 | itech |    3,376 |    3,451 |   75 |
| M    | MECHANICAL SPARE                | 1      | 2019-04-03 | itech |    1,985 |    2,036 |   51 |
| S    | SUNDRY                          | 1      | 2019-04-03 | itech |    1,188 |    1,352 |  164 |
| Z    | FERTILIZER                      | 1      | 2019-04-03 | itech |        6 |        6 |    0 |

### Status Summary
- **Active (Status='1'):** 9 codes — all active, none inactive

### Top References (SP1)
`LLN (3,376) > G (2,926) > M (1,985) > S (1,188) > E (1,053) > L (94) > C (58) > Z (6) > F (3)`

---

## 3. IN_PRODMAT — Product Material / Mill Station Code

**Purpose:** Product material classification. Mostly station-prefixed (STN-*). Used by `IN_ITEMCODE.ProdMatCode`. **Heavily underutilized — 94%+ of items have NULL.**

**PK:** ProdMatCode (char 8)

### All 25 Codes

| Code      | Description                       | Status | Created    | By    | SP1 Refs | SP3 Refs | Diff |
|-----------|-----------------------------------|--------|------------|-------|---------:|---------:|-----:|
| 01        | POWERMAX                          | 1      | 2019-04-03 | itech |       23 |       23 |    0 |
| Compos    | Composting                        | 1      | 2019-04-03 | itech |        7 |        7 |    0 |
| LLN       | LAINNYA                           | 1      | 2019-04-03 | itech |    2,036 |    2,036 |    0 |
| STN-BLR   | STATION BOILER                    | 1      | 2019-04-03 | itech |        1 |        1 |    0 |
| STN-CLR   | STATION CLARIFICATION             | 1      | 2019-04-03 | itech |        1 |        1 |    0 |
| STN-CPO   | STATION CPO STORAGE               | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-DPR   | STATION DEPERICARPING             | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-EFB   | STATION EMPTY FRUIT BUNCH        | 1      | 2019-04-03 | itech |       19 |       19 |    0 |
| STN-ENG   | STATION ENGINE ROOM              | 1      | 2019-04-03 | itech |        9 |        9 |    0 |
| STN-ETP   | STATION EFFLUENT TREATMENT PLANT  | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-FRC   | STATION FRUIT RECEPTION           | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-GEN   | STATION GENERAL                   | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-KER   | STATION KERNEL                   | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-LAB   | STATION LABORATORY               | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-LCP   | LOGISTIC CPO                     | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-LKR   | LOGISTIC KERNEL                  | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-OFF   | STATION OFFICE                   | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-PBS   | STATION PREBREAKER (EFB)         | 1      | 2019-04-03 | itech |       16 |       16 |    0 |
| STN-PRS   | STATION PRESS                    | 1      | 2019-04-03 | itech |       48 |       48 |    0 |
| STN-STR   | STATION STERILIZER               | 1      | 2019-04-03 | itech |        2 |        2 |    0 |
| STN-THR   | STATION THRESHING                | 1      | 2019-04-03 | itech |        0 |        0 |    0 |
| STN-WEG   | STATION WEIGHBRIDGE              | 1      | 2019-04-03 | itech |        1 |        1 |    0 |
| STN-WKP   | STATION WORKSHOP                 | 1      | 2019-04-03 | itech |        1 |        1 |    0 |
| STN-WLR   | WHEEL LOADER                     | 1      | 2019-04-03 | itech |        2 |        2 |    0 |
| STN-WTP   | STATION WATER PLANT              | 1      | 2019-04-03 | itech |        1 |        1 |    0 |

### Status Summary
- **Active (Status='1'):** 25 codes — all active

### Top References (SP1)
`LLN (2,036) > STN-PRS (48) > STN-EFB (19) > STN-PBS (16) > STN-ENG (9) > Compos (7) > 1 (23)`

### Codes with Zero References (SP1 & SP3)
`STN-CPO`, `STN-DPR`, `STN-ETP`, `STN-FRC`, `STN-GEN`, `STN-KER`, `STN-LAB`, `STN-LCP`, `STN-LKR`, `STN-OFF`, `STN-THR` (11 codes = 44% of table)

### Data Quality Issue
Code `'01'` (POWERMAX) is numeric-string, inconsistent with all other `STN-*` prefixed codes.

---

## 4. IN_PRODBRAND — Product Brand / Supplier Code

**Purpose:** Product brand or supplier classification. Mix of named brands (Jenny01, Jenny02, PT prefixes, SP0018) and LLN. Used by `IN_ITEMCODE.ProdBrandCode`. **Heavily underutilized — 94%+ of items have NULL.**

**PK:** ProdBrandCode (char 8)

### All 9 Codes

| Code     | Description                        | Status | Created    | By    | SP1 Refs | SP3 Refs | Diff |
|----------|------------------------------------|--------|------------|-------|---------:|---------:|-----:|
| Jenny01  | MM07201_MM07213_MM07050           | 1      | 2019-06-13 | yencun|        3 |        3 |    0 |
| Jenny02  | MM07196                            | 1      | 2019-07-03 | yencun|        2 |        2 |    0 |
| LLN      | LAINNYA                            | 1      | 2019-04-03 | itech |    7,864 |    8,248 |  384 |
| PT0009   | PT. MULTIPRIMA SEMESTA ABADI       | 1      | 2019-04-03 | itech |      760 |      760 |    0 |
| PT0089   | PT. Tsubaki Indonesia Trading      | 1      | 2019-04-03 | itech |       52 |       52 |    0 |
| PT130    | PT. DUTA JAYA SENTOSA             | 1      | 2019-04-03 | itech |       16 |       16 |    0 |
| PT131    | PT. NOXINDO CAKRAWALA             | 1      | 2019-04-03 | itech |       16 |       16 |    0 |
| REC      | Recondisi                          | 1      | 2019-08-15 | yencun|       29 |       29 |    0 |
| SP0018   | LIONG BROTHERS ENGINEERING SDN BHD | 1      | 2019-04-03 | itech |      100 |      100 |    0 |

### Status Summary
- **Active (Status='1'):** 9 codes — all active

### Top References (SP1)
`LLN (7,864) > PT0009 (760) > SP0018 (100) > PT0089 (52) > REC (29) > PT130 (16) > PT131 (16) > Jenny01 (3) > Jenny02 (2)`

### SP1 vs SP3 Delta
Only LLN differs: SP1=7,864 vs SP3=8,248 (diff=384) — explains the entire LLN-brand difference, consistent with SP3 having 404 more IN_ITEMCODE rows.

### Data Quality Issues
- `Jenny01` and `Jenny02` descriptions reference item codes (MM07201, MM07213, etc.) — appear to be one-off item-specific codes rather than real supplier brands.
- Code `'REC'` here is active (Status='1') unlike in IN_PRODTYPE where REC is inactive (Status='2').

---

## 5. IN_PRODMODEL — Product Model / Origin Classification

**Purpose:** Product origin/type classification. Five codes: CMB (Chemical Boiler), CMP (Chemical Proses), IMPORT (Import Item), LLN (Lainnya), Part. Used by `IN_ITEMCODE.ProdModelCode`. **Heavily underutilized — 95%+ of items have NULL.**

**PK:** ProdModelCode (char 8)

### All 5 Codes

| Code   | Description      | Status | Created    | By    | SP1 Refs | SP3 Refs | Diff |
|--------|------------------|--------|------------|-------|---------:|---------:|-----:|
| CMB    | CHEMICAL BOILER  | 1      | 2019-04-03 | itech |        1 |        1 |    0 |
| CMP    | CHEMICAL PROSES  | 1      | 2019-04-03 | itech |        2 |        2 |    0 |
| IMPORT | Import Item      | 1      | 2019-04-03 | itech |      399 |      399 |    0 |
| LLN    | LAINNYA          | 1      | 2019-04-03 | itech |    5,952 |    5,952 |    0 |
| Part   | Part             | 1      | 2019-04-03 | itech |       11 |       11 |    0 |

### Status Summary
- **Active (Status='1'):** 5 codes — all active

### Top References (SP1)
`LLN (5,952) > IMPORT (399) > Part (11) > CMP (2) > CMB (1)`

### SP1 vs SP3 Delta
Identical non-null counts. SP3 has 404 more NULL entries (5,666 vs 5,262) — consistent with SP3 having 404 more IN_ITEMCODE rows.

---

## 6. IN_STOCKANALYSIS — Stock Movement Analysis Classification

**Purpose:** Stock movement classification. Four codes: DEADS (Dead Stock), FAMOV (Fast Moving), MEMOV (Medium Moving), SLMOV (Slow Moving). Used by `IN_ITEMCODE.StockAnalysisCode`. **Heavily underutilized — 99%+ of items have NULL.**

**PK:** StockAnalysisCode (char 8)

### All 4 Codes

| Code  | Description  | Status | Created    | By    | SP1 Refs | SP3 Refs | Diff |
|-------|--------------|--------|------------|-------|---------:|---------:|-----:|
| DEADS | DEAD STOCK   | 1      | 2019-04-03 | itech |        5 |        5 |    0 |
| FAMOV | FAST MOVING  | 1      | 2019-04-03 | itech |    **0** |    **0** |    0 |
| MEMOV | MEDIUM MOVING| 1      | 2019-04-03 | itech |      356 |      356 |    0 |
| SLMOV | SLOW MOVING  | 1      | 2019-04-03 | itech |      126 |      126 |    0 |

### Status Summary
- **Active (Status='1'):** 4 codes — all active

### Top References (SP1)
`MEMOV (356) > SLMOV (126) > DEADS (5) > FAMOV (0)`

### Notable
**FAMOV (Fast Moving) has ZERO references** — no items are classified as fast-moving stock in the system.

### SP1 vs SP3 Delta
Identical non-null counts. SP3 has 404 more NULL entries (11,544 vs 11,140).

---

## Cross-Table Relationships

All 6 lookup tables feed into `IN_ITEMCODE` as foreign-key classification dimensions:

```
IN_ITEMCODE
    |
    +-- ProdTypeCode      --> IN_PRODTYPE.ProdTypeCode     (51 active, 1 inactive: REC)
    +-- ProdCatCode       --> IN_PRODCAT.ProdCatCode      (9 categories, all active)
    +-- ProdMatCode       --> IN_PRODMAT.ProdMatCode      (25 codes, 11 have zero refs)
    +-- ProdBrandCode      --> IN_PRODBRAND.ProdBrandCode  (9 brands, most use LLN)
    +-- ProdModelCode     --> IN_PRODMODEL.ProdModelCode  (5 codes, most use LLN)
    +-- StockAnalysisCode --> IN_STOCKANALYSIS.StockAnalysisCode (4 codes, FAMOV has 0 refs)
```

---

## SP1 vs SP3 Reference Count Differences

All 6 lookup tables are row-identical between SP1 and SP3. Differences in reference counts are explained entirely by IN_ITEMCODE row count delta (SP1: 11,654 vs SP3: 12,058, diff=404 more Mill rows).

| Field                | Code  | SP1   | SP3   | Diff |
|----------------------|-------|------:|------:|-----:|
| ProdBrandCode         | LLN   | 7,864 | 8,248 |  384 |
| ProdCatCode          | S     | 1,188 | 1,352 |  164 |
| ProdTypeCode          | SUND  | 1,214 | 1,378 |  164 |
| ProdCatCode          | G     | 2,926 | 3,021 |   95 |
| ProdCatCode          | LLN   | 3,376 | 3,451 |   75 |
| ProdTypeCode          | GEN-O | 1,437 | 1,500 |   63 |
| ProdCatCode          | M     | 1,985 | 2,036 |   51 |
| ProdTypeCode          | VSPARE|   855 |   874 |   19 |
| ProdTypeCode          | ELEC-O| 1,007 | 1,023 |   16 |
| ProdTypeCode          | PITING|   308 |   319 |   11 |
| ProdTypeCode          | BOUT  |   238 |   248 |   10 |
| ProdTypeCode          | ALLMAT|     75|     84|     9 |
| ProdTypeCode          | VALPIT|   198 |   202 |    4 |
| ProdTypeCode          | STMAT |     43|     47|     4 |
| ProdTypeCode          | STERIL|     27|     31|     4 |
| ProdTypeCode          | VEEBEL|   105 |   109 |    4 |
| ProdTypeCode          | ELEC-SPR| 714|   717 |    3 |
| ProdTypeCode          | BEAR  |   218 |   220 |    2 |
| ProdTypeCode          | ELDES |     46|     48|     2 |
| ProdTypeCode          | ELFIT |     70|     72|     2 |
| ProdTypeCode          | TRANCAIN| 198|  199 |    1 |

---

## Data Quality Issues

| Table              | Issue                                                                                         |
|--------------------|----------------------------------------------------------------------------------------------|
| IN_PRODTYPE        | REC (Recondisi) is inactive (Status='2') but still in the lookup table.                      |
| IN_PRODTYPE        | Code `'ML      '` (space-padded, 27 refs) vs `'ML'` (15 refs) — same semantic code stored as two distinct values. |
| IN_PRODMAT         | Code `'01'` is numeric-string, inconsistent with all other `STN-*` prefixed codes.          |
| IN_PRODMAT         | 11 of 25 codes (44%) have zero references from IN_ITEMCODE.                                    |
| IN_PRODMAT         | 94%+ of items have no ProdMatCode (NULL/blank). Table is largely unused.                    |
| IN_PRODBRAND       | Jenny01 and Jenny02 appear to be item-specific codes, not real supplier brands.              |
| IN_PRODBRAND       | REC is active (Status='1') here but inactive in IN_PRODTYPE — inconsistent.                 |
| IN_PRODBRAND       | 94%+ of items have no ProdBrandCode. Table is largely unused.                                |
| IN_PRODMODEL       | CMB (1 ref) and CMP (2 refs) have very few references. Most items use LLN.                 |
| IN_PRODMODEL       | 95%+ of items have no ProdModelCode. Table is largely unused.                                |
| IN_STOCKANALYSIS   | FAMOV (Fast Moving) has ZERO references — no items classified as fast-moving.                |
| IN_STOCKANALYSIS   | 99%+ of items have no StockAnalysisCode. Table is largely unused.                           |
| ALL                | All char(N) fields are right-padded. Blank-looking values may be NULL, empty string, or space-padded — three different states. Always RTRIM() + IS NULL awareness needed. |

---

## Usage Notes

- **Best-filled field:** `ProdTypeCode` in IN_ITEMCODE — has the most references and most diverse distribution.
- **Underutilized fields:** `ProdMatCode`, `ProdBrandCode`, `ProdModelCode`, `StockAnalysisCode` — all have 94%+ NULL/blank rates. The mill station `STN-*` prefixes in ProdMatCode suggest this was designed for process traceability but never fully implemented.
- **LLN = "Lainnya" (Others):** In every table, LLN dominates usage — indicating most items don't fit specific classifications and default to "others."
- **FAMOV = Fast Moving with 0 refs:** No inventory items are classified as fast-moving stock.
- **REC code inconsistency:** REC (Recondisi) is inactive in IN_PRODTYPE but active in IN_PRODBRAND — same semantic meaning, different status.
- **ML double-storage:** IN_PRODTYPE stores 'ML' (15 refs) and 'ML      ' (27 refs) separately — same code in two forms.

---

## File Output

- `in_lookup_tables_deepdive.json` — Full schema, all rows, reference counts (SP1 + SP3)
- `IN_LOOKUP_TABLES_MCP.md` — This document
