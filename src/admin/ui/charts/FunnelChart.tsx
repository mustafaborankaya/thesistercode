import type { ReactNode } from 'react'
import { ChartEmpty } from './ChartShell'
import { fmtInt, fmtPct, ordinalFills } from './chartUtils'
import s from './charts.module.css'

export interface FunnelStep {
  key: string
  label: string
  value: number
}

interface FunnelChartProps {
  steps: FunnelStep[]
  format?: (n: number) => string
  /** Adımlar arası geçiş metni: (yüzde) → "%12,5 geçti". */
  rateLabel?: (pct: string) => string
  /** Toplam dönüşüm metni: (yüzde) → "Toplam dönüşüm %2,1". */
  overallLabel?: (pct: string) => string
  note?: ReactNode
  emptyText?: string
}

/**
 * Dönüşüm hunisi: yatay adım çubukları (ilk adıma göre oran), adımlar arasında geçiş yüzdesi, altta toplam
 * dönüşüm. Renk sıralı mürekkep rampası (açıktan koyuya) — adım sırası renkte okunur.
 */
export function FunnelChart({ steps, format = fmtInt, rateLabel, overallLabel, note, emptyText }: FunnelChartProps) {
  const base = steps[0]?.value ?? 0
  if (steps.length === 0 || base <= 0) return <ChartEmpty text={emptyText} height={120} />
  const last = steps[steps.length - 1].value
  return (
    <div className={s.root}>
      <ol className={s.funnel} aria-label={steps.map((st) => `${st.label} ${format(st.value)}`).join(', ')}>
        {steps.map((st, i) => {
          const prev = i > 0 ? steps[i - 1].value : null
          const rate = prev != null && prev > 0 ? (st.value / prev) * 100 : null
          return (
            <li key={st.key} className={s.funnelStep}>
              <span className={s.funnelLabel}>{st.label}</span>
              <span className={s.funnelTrack} aria-hidden="true">
                <span className={s.funnelBar} style={{ width: `${Math.max(st.value > 0 ? 1 : 0, (st.value / base) * 100)}%`, background: ordinalFills[Math.min(i, ordinalFills.length - 1)] }} />
              </span>
              <span className={s.funnelValue}>{format(st.value)}</span>
              {rate != null && rateLabel ? <span className={s.funnelRate}>↓ {rateLabel(fmtPct(rate))}</span> : null}
            </li>
          )
        })}
      </ol>
      {overallLabel ? <p className={s.funnelTotal}>{overallLabel(fmtPct((last / base) * 100, 2))}</p> : null}
      {note}
    </div>
  )
}
