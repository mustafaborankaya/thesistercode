import { useState } from 'react'
import type { AnalyticsShare } from '../../adminApi'
import { ChartEmpty } from './ChartShell'
import { fmtInt, sharePct, sliceFills } from './chartUtils'
import s from './charts.module.css'

interface DonutChartProps {
  title: string
  items: AnalyticsShare[]
  /** Merkezdeki toplamın altındaki küçük etiket (ör. "görüntüleme"). */
  centerLabel?: string
  format?: (n: number) => string
  emptyText?: string
  /** "Diğer" katlama etiketi. */
  otherLabel?: string
}

const SIZE = 132
const R_OUT = 62
const R_IN = 44
const MAX_SLICES = 6

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/** Halka dilimi (annulus sektörü) yolu; `a0 < a1` radyan, saat 12'den başlar. */
function slicePath(a0: number, a1: number): string {
  const c = SIZE / 2
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = polar(c, c, R_OUT, a0)
  const [x1, y1] = polar(c, c, R_OUT, a1)
  const [x2, y2] = polar(c, c, R_IN, a1)
  const [x3, y3] = polar(c, c, R_IN, a0)
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R_OUT} ${R_OUT} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${R_IN} ${R_IN} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`
}

/**
 * Pay grafiği (donut): en fazla 6 dilim (fazlası "Diğer"), dilimler arasında 2px yüzey boşluğu, merkezde
 * toplam, yanında tam lejant (etiket + sayı + yüzde). Renk sırası dilim sırasını izler (en büyük en koyu).
 * Yakın değerleri karşılaştırmak için lejant sayıları esastır; halka yalnızca bütünün bölünüşünü gösterir.
 */
export function DonutChart({ title, items, centerLabel, format = fmtInt, emptyText, otherLabel = 'Diğer' }: DonutChartProps) {
  const [active, setActive] = useState<string | null>(null)
  const nonZero = items.filter((it) => it.count > 0)
  const total = nonZero.reduce((a, it) => a + it.count, 0)
  if (total === 0) return <ChartEmpty text={emptyText} height={120} />

  const sorted = [...nonZero].sort((a, b) => b.count - a.count)
  const shown = sorted.length > MAX_SLICES ? [...sorted.slice(0, MAX_SLICES - 1), { key: '__other', label: otherLabel, count: sorted.slice(MAX_SLICES - 1).reduce((a, it) => a + it.count, 0) }] : sorted

  const gap = shown.length > 1 ? 2 / R_OUT : 0 // 2px yüzey boşluğu (radyan, dış yarıçapta)
  const starts = shown.reduce<number[]>((acc, it) => [...acc, acc[acc.length - 1] + (it.count / total) * Math.PI * 2], [-Math.PI / 2])
  const slices = shown.map((it, i) => {
    const span = starts[i + 1] - starts[i]
    const g = Math.min(gap, span / 3)
    return { ...it, fill: sliceFills[i], d: slicePath(starts[i] + g / 2, starts[i + 1] - g / 2) }
  })
  const c = SIZE / 2
  const aria = `${title}: ${shown.map((it) => `${it.label} ${sharePct(it.count, total)}`).join(', ')}.`

  return (
    <div className={[s.root, s.donut].join(' ')}>
      <svg className={s.donutSvg} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={aria} onPointerLeave={() => setActive(null)}>
        {slices.length === 1 ? (
          <circle cx={c} cy={c} r={(R_OUT + R_IN) / 2} fill="none" stroke={slices[0].fill} strokeWidth={R_OUT - R_IN} className={s.donutSlice} />
        ) : (
          slices.map((sl) => (
            <path key={sl.key} d={sl.d} fill={sl.fill} className={[s.donutSlice, active && active !== sl.key ? s.donutSliceDim : ''].join(' ')} onPointerEnter={() => setActive(sl.key)}>
              <title>{`${sl.label}: ${format(sl.count)} (${sharePct(sl.count, total)})`}</title>
            </path>
          ))
        )}
        <text x={c} y={c - (centerLabel ? 3 : 0)} dy="0.35em" textAnchor="middle" className={s.donutCenterValue}>
          {format(total)}
        </text>
        {centerLabel ? (
          <text x={c} y={c + 14} dy="0.35em" textAnchor="middle" className={s.donutCenterLabel}>
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <ul className={s.donutLegend} onPointerLeave={() => setActive(null)}>
        {slices.map((sl) => (
          <li key={sl.key} className={[s.donutLegendRow, active === sl.key ? s.donutLegendRowActive : ''].join(' ')} onPointerEnter={() => setActive(sl.key)}>
            <span className={s.legendSwatch} style={{ background: sl.fill }} aria-hidden="true" />
            <span className={s.donutLegendLabel}>{sl.label}</span>
            <span className={s.donutLegendValue}>{format(sl.count)}</span>
            <span className={s.donutLegendShare}>{sharePct(sl.count, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
