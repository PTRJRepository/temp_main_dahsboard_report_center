/* Hallmark · component: ops-pdf · genre: utilitarian · theme: estate-ink
 * states: n/a (print artifact)
 * contrast: high (B&W-safe)
 */

export type PdfPreviewInput = {
  reportId: string
  reportTitle: string
  reportCode?: string
  description?: string
  sourceLabel: string
  periodLabel?: string
  generatedAt?: string
  filters?: Record<string, unknown>
  rows: Array<Record<string, unknown>>
  columns: string[]
  /** Known full count when rows are truncated for PDF */
  totalRowCount?: number
  maxRows?: number
  maxColumns?: number
  formatValue: (value: unknown, field?: string) => string
  displayColumnLabel: (column: string) => string
}

/** Prefer identity / qty / amount columns when soft-capping width */
const COLUMN_PRIORITY = [
  'itemcode',
  'itemcodedesc',
  'itemdescription',
  'description',
  'loccode',
  'locdesc',
  'producttypecode',
  'prodtypecode',
  'prodcatcode',
  'stockanalysiscode',
  'movementcategory',
  'qtyonhand',
  'qtyonhold',
  'qtyonorder',
  'quantityopening',
  'quantityclosing',
  'qty',
  'quantity',
  'amount',
  'averagecost',
  'stockvalue',
  'unit',
  'uom',
]

const INK = { r: 20, g: 26, b: 22 }
const INK_MUTED = { r: 74, g: 85, b: 76 }
const RULE = { r: 11, g: 42, b: 28 }
const HEADER_FG = { r: 245, g: 255, b: 245 }
const ZEBRA = { r: 243, g: 246, b: 243 }
const RULE_SOFT = { r: 201, g: 210, b: 203 }
const WARN = { r: 138, g: 90, b: 0 }

export function safeFilePart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'report'
}

export function shortText(value: string, limit: number) {
  if (limit <= 1) return '…'
  return value.length > limit ? `${value.slice(0, Math.max(0, limit - 1))}…` : value
}

export function activeFilterText(filters: Record<string, unknown> = {}) {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)
  return entries.length ? entries.join(' · ') : 'all'
}

export function isNumericValue(value: unknown) {
  return typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:[.,]\d+)?$/.test(value.trim()))
}

function priorityScore(column: string) {
  const key = column.toLowerCase()
  const exact = COLUMN_PRIORITY.indexOf(key)
  if (exact >= 0) return exact
  if (/qty|quantity|amount|cost|value|price/i.test(column)) return 40
  if (/code|loc|type|cat|date|period/i.test(column)) return 50
  return 80
}

/** Soft-cap columns while keeping high-signal inventory fields */
export function pickPdfColumns(columns: string[], maxColumns: number) {
  if (columns.length <= maxColumns) return columns.slice()
  return columns
    .map((column, index) => ({ column, index, score: priorityScore(column) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, maxColumns)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.column)
}

function charsForWidth(width: number, fontSize: number) {
  // helvetica ~0.5em average glyph width in pt
  return Math.max(4, Math.floor(width / (fontSize * 0.48)))
}

function buildFilename(reportId: string, periodLabel?: string) {
  const period = periodLabel ? safeFilePart(periodLabel) : 'current'
  return `${safeFilePart(reportId)}-${period}.pdf`
}

/**
 * Estate ops print pack — shared template for every live inventory report.
 * No watermark. High-contrast. Truncation honesty in footer.
 */
export async function saveReportPdfPreview(input: PdfPreviewInput) {
  const { default: JsPDF } = await import('jspdf')

  const maxRows = input.maxRows ?? 2000
  const maxColumns = input.maxColumns ?? 10
  const columns = pickPdfColumns(input.columns, maxColumns)
  const allRows = input.rows
  const rows = allRows.slice(0, maxRows)
  const totalKnown = input.totalRowCount ?? allRows.length
  const truncated = totalKnown > rows.length || allRows.length > rows.length

  const usePortrait = columns.length <= 4
  const orientation = usePortrait ? 'portrait' : 'landscape'
  const doc = new JsPDF({ orientation, unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 28
  const tableWidth = pageWidth - margin * 2
  const rowHeight = 15
  const headerBand = 22
  const footerY = pageHeight - 16
  const bottomLimit = pageHeight - 40
  const colWidth = tableWidth / Math.max(columns.length, 1)

  const generatedAt = input.generatedAt ?? new Date().toLocaleString('id-ID')
  const filterLine = activeFilterText(input.filters)
  const metaLine = [input.reportCode, input.sourceLabel, input.periodLabel]
    .filter(Boolean)
    .join(' · ')

  // Approximate page count for footer (masthead ~78pt before first row)
  const firstPageBody = Math.max(1, Math.floor((bottomLimit - (margin + 78)) / rowHeight))
  const nextPageBody = Math.max(1, Math.floor((bottomLimit - (margin + 78)) / rowHeight))
  const totalPages =
    rows.length === 0
      ? 1
      : rows.length <= firstPageBody
        ? 1
        : 1 + Math.ceil((rows.length - firstPageBody) / nextPageBody)

  let y = margin
  let page = 1
  let rowCursor = 0

  const setInk = (c: { r: number; g: number; b: number }) => doc.setTextColor(c.r, c.g, c.b)
  const setFill = (c: { r: number; g: number; b: number }) => doc.setFillColor(c.r, c.g, c.b)

  const drawTopRule = () => {
    setFill(RULE)
    doc.rect(margin, margin - 10, tableWidth, 3, 'F')
  }

  const drawFooter = () => {
    doc.setDrawColor(RULE_SOFT.r, RULE_SOFT.g, RULE_SOFT.b)
    doc.setLineWidth(0.5)
    doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    setInk(INK_MUTED)
    const shown = rows.length.toLocaleString('id-ID')
    const total = totalKnown.toLocaleString('id-ID')
    const truncNote = truncated
      ? ` · truncated — use Excel for full (${total})`
      : ` · ${shown} rows`
    const left = shortText(
      `${input.reportId}${truncNote}`,
      charsForWidth(tableWidth * 0.72, 7),
    )
    const right = `p.${page}/${totalPages} · read-only`
    doc.text(left, margin, footerY)
    doc.text(right, pageWidth - margin, footerY, { align: 'right' })
  }

  const drawMasthead = () => {
    y = margin + 8
    drawTopRule()
    y = margin + 14

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    setInk(RULE)
    doc.text('PTRJ · Report Center', margin, y)

    doc.setFont('helvetica', 'normal')
    setInk(INK_MUTED)
    const rightMeta = shortText(
      [input.sourceLabel, input.periodLabel, generatedAt].filter(Boolean).join(' · '),
      charsForWidth(tableWidth * 0.55, 8),
    )
    doc.text(rightMeta, pageWidth - margin, y, { align: 'right' })
    y += 14

    if (input.reportCode) {
      setFill(RULE)
      const code = shortText(input.reportCode, 28)
      const codeW = Math.min(tableWidth * 0.35, 8 + code.length * 5.2)
      doc.roundedRect(margin, y - 9, codeW, 12, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      setInk(HEADER_FG)
      doc.text(code, margin + 4, y)
      y += 16
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    setInk(INK)
    doc.text(shortText(input.reportTitle, charsForWidth(tableWidth, 13)), margin, y)
    y += 14

    if (input.description) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      setInk(INK_MUTED)
      doc.text(shortText(input.description, charsForWidth(tableWidth, 8)), margin, y)
      y += 12
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setInk(INK_MUTED)
    if (metaLine) {
      doc.text(shortText(metaLine, charsForWidth(tableWidth, 8)), margin, y)
      y += 11
    }

    doc.setFontSize(7.5)
    setInk(truncated && truncated ? WARN : INK_MUTED)
    doc.text(
      shortText(`Filters: ${filterLine}`, charsForWidth(tableWidth, 7.5)),
      margin,
      y,
    )
    y += 10

    doc.setDrawColor(RULE_SOFT.r, RULE_SOFT.g, RULE_SOFT.b)
    doc.setLineWidth(0.6)
    doc.line(margin, y, pageWidth - margin, y)
    y += 14
  }

  const drawTableHeader = () => {
    setFill(RULE)
    doc.rect(margin, y - 10, tableWidth, headerBand, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    setInk(HEADER_FG)
    const labelLimit = charsForWidth(colWidth - 8, 7)
    columns.forEach((column, index) => {
      const label = shortText(input.displayColumnLabel(column), labelLimit)
      const x = margin + index * colWidth + 4
      doc.text(label, x, y + 2)
    })
    y += headerBand - 2
  }

  const startPageChrome = () => {
    drawMasthead()
    drawTableHeader()
  }

  const newPage = () => {
    drawFooter()
    doc.addPage('a4', orientation)
    page += 1
    startPageChrome()
  }

  startPageChrome()

  if (rows.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    setInk(INK_MUTED)
    doc.text('Tidak ada baris untuk diekspor.', margin, y + 8)
    drawFooter()
    doc.save(buildFilename(input.reportId, input.periodLabel))
    return
  }

  // sample numeric alignment per column from first non-empty cells
  const numericCol = columns.map((column) => {
    for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
      const raw = rows[i]?.[column]
      if (raw === null || raw === undefined || raw === '') continue
      return isNumericValue(raw)
    }
    return false
  })

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (y > bottomLimit) newPage()

    const row = rows[rowIndex]
    if (rowIndex % 2 === 0) {
      setFill(ZEBRA)
      doc.rect(margin, y - 10, tableWidth, rowHeight, 'F')
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    setInk(INK)
    const cellLimit = charsForWidth(colWidth - 10, 7)

    columns.forEach((column, index) => {
      const raw = row[column]
      const text = shortText(input.formatValue(raw, column), cellLimit)
      const xLeft = margin + index * colWidth + 4
      if (numericCol[index]) {
        doc.text(text, margin + (index + 1) * colWidth - 4, y, { align: 'right' })
      } else {
        doc.text(text, xLeft, y)
      }
    })

    y += rowHeight
    rowCursor = rowIndex + 1
  }

  // silence unused in production builds
  void rowCursor

  drawFooter()
  doc.save(buildFilename(input.reportId, input.periodLabel))
}

/** @deprecated alias — same as saveReportPdfPreview (ops pack) */
export const saveInventoryOpsPdf = saveReportPdfPreview
