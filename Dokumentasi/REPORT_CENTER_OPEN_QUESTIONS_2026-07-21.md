# Report Center Redesign — Open Questions Log

**Date:** 2026-07-21  
**Rule:** Unresolved items must not be silently assumed by agents. Mark RESOLVED when user/code decides.

---

## Product / UX

| ID | Question | Default if forced | Status |
| --- | --- | --- | --- |
| Q1 | Should sticky include KPI strip or only control bar? | Control bar only; KPI scrolls | OPEN |
| Q2 | Default tab on monthly open? | Ringkasan | OPEN |
| Q3 | Keep PDF at all? | Keep as labeled preview | OPEN |
| Q4 | Excel client vs job queue threshold? | Warn >5k; job >20k later | OPEN |
| Q5 | AI default open or closed? | Closed | lean closed |
| Q6 | ID-only UI or bilingual? | ID primary, EN tooltip | OPEN |
| Q7 | Hard-coded preset period 2026-07? | Label “contoh” or use current month | OPEN |

## Data / accounting

| ID | Question | Default if forced | Status |
| --- | --- | --- | --- |
| Q8 | Primary 6: include Retur always if ~0? | Show with 0 | OPEN |
| Q9 | Purchasing net vs separate GR/Retur? | Separate GR + Retur (dictionary) | lean dictionary |
| Q10 | Inventory placeholder bucket in UI? | Hide from Ringkasan | lean hide |
| Q11 | Official PDF column parity mandatory on default view? | Yes for monthly businessColumns | lean yes |
| Q12 | Exact recon equation for waterfall? | Only if verified in SQL tests | OPEN |

## Engineering

| ID | Question | Default if forced | Status |
| --- | --- | --- | --- |
| Q13 | Feature flag for new workspaces? | Optional `NEXT_PUBLIC_REPORT_DETAIL_V2` | OPEN |
| Q14 | Merge InventoryOverview into InventoryReportsClient? | Investigate then merge/delete | OPEN |
| Q15 | Live report count 19 vs docs 27? | Trust config.ts live status | RESOLVED-ish (snapshot doc) |
| Q16 | Gateway picker visibility? | Settings/Audit for non-admin ops | OPEN |

## User decisions needed (highest value)

1. Q3 PDF keep/remove  
2. Q1 sticky height policy  
3. Q9 metric strip composition sign-off  
4. Q13 feature flag yes/no  

Until answered, agents follow **Default if forced** column and note assumption in PR.

---

**End open questions.**
