from pathlib import Path

src_path = Path('app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx')
lines = src_path.read_text(encoding='utf-8').splitlines(True)

start = end = None
for i, line in enumerate(lines):
    if "{!loading && (workspaceTab === 'ringkasan' || tableExpanded) && (kpiCards.length > 0 || stickyGrandTotals.length > 0) && (" in line:
        start = i
    if start is not None and i > start and line.strip() == ')}' and i + 1 < len(lines) and lines[i + 1].strip() == '</section>':
        end = i + 1
        break

if start is None or end is None:
    raise SystemExit(f'block bounds missing start={start} end={end}')

block_lines = lines[start:end]
jsx_body = ''.join(block_lines[1:-1])

comp = f"""'use client'

import {{ ChevronDown, ChevronRight }} from 'lucide-react'
import type {{ ReportFilterInput }} from '@/lib/reports/report-filtering'

type DbRow = Record<string, unknown>

export type ReportKpiCardLike = {{
  label: string
  value: unknown
  description: string
  tone: string
  scope?: string
  groupField?: string
  groupKey?: string
  flowSection?: string
  sourceTable?: string
  sourceField?: string
  metrics?: Array<{{ key: string; label: string; value: unknown; sourceTable?: string; sourceField?: string }}>
  simpleSql?: string
}}

export type MonthlyStockRingkasanProps = {{
  isMonthlyStockMovement: boolean
  stickyGrandTotals: Array<{{ key: string; label: string; value: unknown }}>
  flowKpiCards: ReportKpiCardLike[]
  globalKpiCards: ReportKpiCardLike[]
  breakdownKpiCards: ReportKpiCardLike[]
  subKpiCards: ReportKpiCardLike[]
  movementCategoryKpiCards: ReportKpiCardLike[]
  monthlySecondaryOpen: boolean
  setMonthlySecondaryOpen: (updater: (open: boolean) => boolean) => void
  resolvedMonthlyAnalysisGroup: string
  activeMonthlyMovementWindow: string
  analysisGroupOptions: ReadonlyArray<{{ field: string; label: string }}>
  movementWindowOptions: ReadonlyArray<{{ value: string; label: string }}>
  requestFilters: ReportFilterInput
  payload: {{ summary?: DbRow; metadata?: DbRow }} | null
  appliedFilters: ReportFilterInput
  viewerProfile: {{ kpiPresetByLabel?: Record<string, string> }}
  compactMetric: (value: unknown, field?: string, label?: string) => string
  formatValue: (value: unknown, field?: string) => string
  displayColumnLabel: (field: string) => string
  openKpiSqlDebug: (event: {{ preventDefault: () => void; stopPropagation: () => void }}, kpi: ReportKpiCardLike) => void
  applyKpiFilter: (label: string) => void
  applySubKpiCardFilter: (kpi: ReportKpiCardLike) => void
  applyMonthlyAnalysisGroup: (groupBy: string) => void
  applyMonthlyMovementWindow: (window: string) => void
  commitReportFilters: (filters: ReportFilterInput, message: string | null) => void
  setReportInfoVisible: (value: boolean) => void
  setReportInfoManuallyOpened: (value: boolean) => void
  setManualFilterOpen: (value: boolean) => void
}}

export function MonthlyStockRingkasan(props: MonthlyStockRingkasanProps) {{
  const {{
    isMonthlyStockMovement,
    stickyGrandTotals,
    flowKpiCards,
    globalKpiCards,
    breakdownKpiCards,
    subKpiCards,
    movementCategoryKpiCards,
    monthlySecondaryOpen,
    setMonthlySecondaryOpen,
    resolvedMonthlyAnalysisGroup,
    activeMonthlyMovementWindow,
    analysisGroupOptions,
    movementWindowOptions,
    requestFilters,
    payload,
    appliedFilters,
    viewerProfile,
    compactMetric,
    formatValue,
    displayColumnLabel,
    openKpiSqlDebug,
    applyKpiFilter,
    applySubKpiCardFilter,
    applyMonthlyAnalysisGroup,
    applyMonthlyMovementWindow,
    commitReportFilters,
    setReportInfoVisible,
    setReportInfoManuallyOpened,
    setManualFilterOpen,
  }} = props

  const MONTHLY_ANALYSIS_GROUP_OPTIONS = analysisGroupOptions
  const MONTHLY_MOVEMENT_WINDOW_OPTIONS = movementWindowOptions

  return (
{jsx_body}  )
}}

export default MonthlyStockRingkasan
"""

out = Path('components/report-center/MonthlyStockRingkasan.tsx')
out.write_text(comp, encoding='utf-8')
print('wrote', out, out.stat().st_size)

replacement = """        {!loading && (workspaceTab === 'ringkasan' || tableExpanded) && (kpiCards.length > 0 || stickyGrandTotals.length > 0) && (
          <MonthlyStockRingkasan
            isMonthlyStockMovement={isMonthlyStockMovement}
            stickyGrandTotals={stickyGrandTotals}
            flowKpiCards={flowKpiCards}
            globalKpiCards={globalKpiCards}
            breakdownKpiCards={breakdownKpiCards}
            subKpiCards={subKpiCards}
            movementCategoryKpiCards={movementCategoryKpiCards}
            monthlySecondaryOpen={monthlySecondaryOpen}
            setMonthlySecondaryOpen={setMonthlySecondaryOpen}
            resolvedMonthlyAnalysisGroup={resolvedMonthlyAnalysisGroup}
            activeMonthlyMovementWindow={activeMonthlyMovementWindow}
            analysisGroupOptions={MONTHLY_ANALYSIS_GROUP_OPTIONS}
            movementWindowOptions={MONTHLY_MOVEMENT_WINDOW_OPTIONS}
            requestFilters={requestFilters}
            payload={payload}
            appliedFilters={appliedFilters}
            viewerProfile={viewerProfile}
            compactMetric={compactMetric}
            formatValue={formatValue}
            displayColumnLabel={displayColumnLabel}
            openKpiSqlDebug={openKpiSqlDebug}
            applyKpiFilter={applyKpiFilter}
            applySubKpiCardFilter={applySubKpiCardFilter}
            applyMonthlyAnalysisGroup={applyMonthlyAnalysisGroup}
            applyMonthlyMovementWindow={applyMonthlyMovementWindow}
            commitReportFilters={commitReportFilters}
            setReportInfoVisible={setReportInfoVisible}
            setReportInfoManuallyOpened={setReportInfoManuallyOpened}
            setManualFilterOpen={setManualFilterOpen}
          />
        )}
"""

new_lines = lines[:start] + [replacement] + lines[end:]
text = ''.join(new_lines)
if "from '@/components/report-center/MonthlyStockRingkasan'" not in text:
    text = text.replace(
        "import AppliedFilterBar from '@/components/report-center/AppliedFilterBar'\n",
        "import AppliedFilterBar from '@/components/report-center/AppliedFilterBar'\nimport MonthlyStockRingkasan from '@/components/report-center/MonthlyStockRingkasan'\n",
        1,
    )
src_path.write_text(text, encoding='utf-8')
print('viewer lines', len(text.splitlines()))
print('call present', '<MonthlyStockRingkasan' in text)
