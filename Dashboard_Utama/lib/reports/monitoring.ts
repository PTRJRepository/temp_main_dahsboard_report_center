import type { VisualPoint } from '@/lib/reports/intelligence'

export type MonitoringTone = 'green' | 'blue' | 'gold' | 'red' | 'slate'

export type MonitoringVisualData = {
  kpis: Array<{ label: string; value: string; tone: MonitoringTone }>
  trend: VisualPoint[]
  breakdown: VisualPoint[]
  composition: VisualPoint[]
  ranking: Array<{ label: string; value: string; note: string }>
  alerts: Array<{ title: string; detail: string; tone: MonitoringTone }>
  accent: string
  title: string
  badge?: string
}
