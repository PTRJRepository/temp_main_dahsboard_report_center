'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export type FlowStage = {
  id: string
  label: string
  value: string
  hint: string
  tone: 'pr' | 'po' | 'gr' | 'issue' | 'return'
}

type ProcurementFlowStripProps = {
  stages: FlowStage[]
  onSelect?: (stageId: string) => void
}

const TONE_STYLES: Record<FlowStage['tone'], { border: string; glow: string; text: string; dot: string }> = {
  pr: { border: 'border-sky-300/30', glow: 'bg-sky-400/10', text: 'text-sky-100', dot: 'bg-sky-300' },
  po: { border: 'border-amber-300/30', glow: 'bg-amber-400/10', text: 'text-amber-100', dot: 'bg-amber-300' },
  gr: { border: 'border-emerald-300/30', glow: 'bg-emerald-400/10', text: 'text-emerald-100', dot: 'bg-emerald-300' },
  issue: { border: 'border-cyan-300/30', glow: 'bg-cyan-400/10', text: 'text-cyan-100', dot: 'bg-cyan-300' },
  return: { border: 'border-lime-300/30', glow: 'bg-lime-400/10', text: 'text-lime-100', dot: 'bg-lime-300' },
}

/**
 * Flow strip interaktif PR → PO → GR → Issue → Return.
 * Konektor ber-animasi (framer-motion) — alur terasa hidup, bukan statis.
 */
export default function ProcurementFlowStrip({ stages, onSelect }: ProcurementFlowStripProps) {
  return (
    <div className="flex flex-wrap items-stretch gap-y-2" role="list" aria-label="Alur proses procurement">
      {stages.map((stage, index) => {
        const tone = TONE_STYLES[stage.tone]
        return (
          <div key={stage.id} className="flex items-stretch" role="listitem">
            <motion.button
              type="button"
              onClick={() => onSelect?.(stage.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2 }}
              className={`rc-kpi-surface relative flex min-w-[128px] flex-col justify-between gap-1 overflow-hidden rounded-2xl px-3 py-2.5 text-left ${tone.border}`}
            >
              <span className={`pointer-events-none absolute -right-6 -top-8 h-16 w-16 rounded-full ${tone.glow} blur-xl`} aria-hidden="true" />
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                <span className="rc-eyebrow text-[var(--rc-text-faint)]">{stage.label}</span>
              </span>
              <strong className={`rc-metric text-lg font-bold ${tone.text}`}>{stage.value}</strong>
              <span className="rc-data text-[10px] text-[var(--rc-text-faint)]">{stage.hint}</span>
            </motion.button>

            {index < stages.length - 1 ? (
              <span className="relative mx-1 flex w-7 items-center justify-center self-center" aria-hidden="true">
                <motion.span
                  className="block h-px w-full bg-[linear-gradient(90deg,rgba(155,226,61,.05),rgba(155,226,61,.5),rgba(155,226,61,.05))]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: index * 0.08 + 0.15, duration: 0.4 }}
                  style={{ transformOrigin: 'left' }}
                />
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 + 0.3, duration: 0.3 }}
                  className="absolute text-[var(--rc-forest-accent)]"
                >
                  <ArrowRight size={12} />
                </motion.span>
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
