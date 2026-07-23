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
  maxRows?: number
  maxColumns?: number
  formatValue: (value: unknown, field?: string) => string
  displayColumnLabel: (column: string) => string
}

function safeFilePart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'report'
}

function shortText(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, Math.max(0, limit - 1))}…` : value
}

function activeFilterText(filters: Record<string, unknown> = {}) {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)
  return entries.length ? entries.join(' · ') : 'none'
}

function isNumericValue(value: unknown) {
  return typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:[.,]\d+)?$/.test(value.trim()))
}

export async function saveReportPdfPreview(input: PdfPreviewInput) {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const maxRows = input.maxRows ?? 34
  const maxColumns = input.maxColumns ?? 7
  const columns = input.columns.slice(0, maxColumns)
  const rows = input.rows.slice(0, maxRows)
  const tableWidth = pageWidth - margin * 2
  const rowHeight = 18
  const columnWidth = tableWidth / Math.max(columns.length, 1)
  let y = margin

  const drawFooter = (page: number) => {
    doc.setFontSize(8)
    doc.setTextColor(110, 110, 110)
    doc.text(
      `PRATINJAU · shown ${rows.length.toLocaleString('id-ID')} rows × ${columns.length} columns · bukan laporan resmi · page ${page}`,
      margin,
      pageHeight - 18,
    )
  }

  const drawWatermark = () => {
    doc.setFontSize(56)
    doc.setTextColor(225, 225, 225)
    doc.text('PRATINJAU', pageWidth / 2, pageHeight / 2, { align: 'center', angle: -18 })
  }

  const drawHeader = () => {
    drawWatermark()
    doc.setTextColor(20, 40, 30)
    doc.setFontSize(15)
    doc.text(shortText(input.reportTitle, 92), margin, y)
    y += 17
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(shortText([input.reportCode, input.sourceLabel, input.periodLabel].filter(Boolean).join(' · '), 130), margin, y)
    y += 13
    doc.text(shortText(`Generated ${input.generatedAt ?? new Date().toLocaleString('id-ID')} · Filters: ${activeFilterText(input.filters)}`, 150), margin, y)
    y += 18
    if (input.description) {
      doc.setTextColor(100, 100, 100)
      doc.text(shortText(input.description, 145), margin, y)
      y += 18
    }
  }

  const drawTableHeader = () => {
    doc.setFillColor(8, 40, 26)
    doc.rect(margin, y - 11, tableWidth, rowHeight, 'F')
    doc.setFontSize(7)
    doc.setTextColor(245, 255, 245)
    columns.forEach((column, index) => {
      doc.text(shortText(input.displayColumnLabel(column), 18), margin + index * columnWidth + 4, y)
    })
    y += rowHeight
  }

  drawHeader()
  drawTableHeader()

  rows.forEach((row, rowIndex) => {
    if (y > pageHeight - 44) {
      drawFooter(doc.getNumberOfPages())
      doc.addPage('a4', 'landscape')
      y = margin
      drawHeader()
      drawTableHeader()
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 248)
      doc.rect(margin, y - 11, tableWidth, rowHeight, 'F')
    }
    doc.setFontSize(7)
    doc.setTextColor(35, 35, 35)
    columns.forEach((column, index) => {
      const raw = row[column]
      const text = shortText(input.formatValue(raw, column), 18)
      const x = margin + index * columnWidth + 4
      if (isNumericValue(raw)) {
        doc.text(text, x + columnWidth - 8, y, { align: 'right' })
      } else {
        doc.text(text, x, y)
      }
    })
    y += rowHeight
  })

  drawFooter(doc.getNumberOfPages())
  doc.save(`${safeFilePart(input.reportId)}-pratinjau.pdf`)
}
