import type { ReportViewerProfile } from './types'
import { genericTechnicalColumns } from './constants'

export function preferredVisibleColumnsForProfile(profile: ReportViewerProfile, columns: string[]) {
  const preferred = (profile.businessColumns ?? []).filter((column) => columns.includes(column))
  const fallback = (profile.fallbackColumns ?? []).filter((column) => columns.includes(column) && !preferred.includes(column))
  const movementActual = [
    'MovementCategory',
    'MovementActivityCountActual',
    'MovementActivityQtyActual',
    'MovementActivityAmountActual',
    'MovementIssueCountActual',
    'MovementIssueQtyActual',
    'MovementIssueAmountActual',
    'MovementLastIssueDate',
  ].filter((column) => columns.includes(column) && !preferred.includes(column) && !fallback.includes(column))
  const hidden = profile.technicalColumns ?? genericTechnicalColumns
  const rest = columns.filter((column) => !preferred.includes(column) && !fallback.includes(column) && !movementActual.includes(column) && !hidden.has(column))
  return [...preferred, ...movementActual, ...fallback, ...rest].slice(0, profile.maxInitialColumns ?? 16)
}

