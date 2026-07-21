from pathlib import Path
import re

path = Path('app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx')
text = path.read_text(encoding='utf-8')
lines = text.splitlines(True)

# 1) Insert import after report-filtering import block
import_marker = "from '@/lib/reports/report-filtering'\n"
import_block = """from '@/lib/reports/report-filtering'
import {
  ASSET_VALUATION_REPORT_IDS,
  MONTHLY_CONTEXT_DETAIL_COLUMNS,
  MONTHLY_OFFICIAL_DETAIL_COLUMNS,
  MONTHLY_STOCK_MOVEMENT_REPORT_IDS,
  MOVEMENT_ANALYSIS_REPORT_IDS,
  STOCK_AGING_REPORT_IDS,
  getReportViewerProfile,
  preferredVisibleColumnsForProfile,
  type ProfileBuilders,
  type ReportViewerProfile,
} from '@/lib/reports/inventory/viewer-profiles'
"""
if "from '@/lib/reports/inventory/viewer-profiles'" not in text:
    if import_marker not in text:
        raise SystemExit('import marker not found')
    text = text.replace(import_marker, import_block, 1)

# 2) Remove local ReportPreset + ReportViewerProfile types
text = re.sub(
    r"\ntype ReportPreset = \{[\s\S]*?\n\}\n\ntype ReportViewerProfile = \{[\s\S]*?\n\}\n",
    "\n",
    text,
    count=1,
)

# 3) Remove local ID sets that are now imported (keep MONTHLY_ANALYSIS_GROUP_OPTIONS)
text = re.sub(
    r"\nconst STOCK_AGING_REPORT_IDS = new Set\(\[[^\]]*\]\)\n"
    r"const MOVEMENT_ANALYSIS_REPORT_IDS = new Set\(\[[^\]]*\]\)\n"
    r"const ASSET_VALUATION_REPORT_IDS = new Set\(\[[^\]]*\]\)\n"
    r"const MONTHLY_STOCK_MOVEMENT_REPORT_IDS = new Set\(\[[^\]]*\]\)\n",
    "\n",
    text,
    count=1,
)

# 4) Remove MONTHLY_OFFICIAL_DETAIL_COLUMNS and MONTHLY_CONTEXT_DETAIL_COLUMNS arrays
text = re.sub(
    r"\nconst MONTHLY_OFFICIAL_DETAIL_COLUMNS = \[[\s\S]*?\]\n"
    r"const MONTHLY_CONTEXT_DETAIL_COLUMNS = \[[\s\S]*?\]\n",
    "\n",
    text,
    count=1,
)

# 5) Remove PERIOD_SCOPED_REPORT_IDS if present and unused later — keep for now if referenced
# Remove genericTechnicalColumns + periodContextColumns + profile column constants through assetValuationTechnicalColumns
# This is the block from genericTechnicalColumns to just before uniqueValues/function after asset set.

# Safer: remove getReportViewerProfile function and preferredVisibleColumnsForProfile function only first,
# then remove constants that become unused.

# Remove getReportViewerProfile function
text = re.sub(
    r"\nfunction getReportViewerProfile\(reportId: string\): ReportViewerProfile \{[\s\S]*?\n\}\n\nfunction preferredVisibleColumnsForProfile",
    "\nfunction preferredVisibleColumnsForProfile",
    text,
    count=1,
)

# If getReportViewerProfile still has builders signature from failed earlier edit, handle both
text = re.sub(
    r"\nfunction getReportViewerProfile\(reportId: string(?:, builders: ProfileBuilders)?\): ReportViewerProfile \{[\s\S]*?\n\}\n",
    "\n",
    text,
    count=1,
)

# Remove preferredVisibleColumnsForProfile local function
text = re.sub(
    r"\nfunction preferredVisibleColumnsForProfile\(profile: ReportViewerProfile, columns: string\[\]\) \{[\s\S]*?\n\}\n",
    "\n",
    text,
    count=1,
)

# 6) Wire call site
old_call = "const viewerProfile = useMemo(() => getReportViewerProfile(report.id), [report.id])"
new_call = """const viewerProfile = useMemo(() => getReportViewerProfile(report.id, {
    genericKpis,
    genericQualityItems,
    genericTopRows,
    movementAnalysisKpis,
    movementAnalysisQualityItems,
    movementAnalysisTopItems,
    stockAgingKpis,
    stockAgingQualityItems,
    stockAgingTopItems,
    assetValuationKpis,
    monthlyStockMovementKpis,
    toNumber,
  }), [report.id])"""
if old_call not in text:
    # maybe already modified
    if 'getReportViewerProfile(report.id, {' not in text:
        raise SystemExit('call site not found')
else:
    text = text.replace(old_call, new_call, 1)

path.write_text(text, encoding='utf-8')
print('wired viewer imports + removed local getReportViewerProfile/preferredVisibleColumns')
print('lines now', len(text.splitlines()))
