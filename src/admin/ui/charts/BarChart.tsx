import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ChartEmpty, ChartTooltip, DataDetails, TipRow } from './ChartShell'
import { axisFormatter, fmtInt, niceTicks, pickTickIndexes, stepIndex, toneFill } from './chartUtils'
import { useMeasure } from './useMeasure'
import s from './charts.module.css'

interface BarChartProps {
  title: string
  /** Eksen etiketleri (kısa). */
  labels: string[]
  /** İpucu/tablo etiketleri (uzun); verilmezse `labels`. */
  longLabels?: string[]
  values: number[]
  /** Seri adı (ipucu ve tablo başlığı). */
  valueLabel: string
  height?: number
  format?: (n: number) => string
  /** Y ekseni etiketi biçimi (verilmezse üst değere göre tam sayı ya da kısa biçim). */
  tickFormat?: (n: number) => string
  tableCaption?: string
  emptyText?: string
  /** Tüm etiketleri göster (ör. 7 gün). */
  allLabels?: boolean
}

const PAD_L = 44
const PAD_R = 8
const PAD_T = 18
const PAD_B = 24

/**
 * Dikey çubuk grafiği (tek seri): ≤24px ince çubuk, 4px yuvarlak uç, 2px yüzey boşluğu, yalnızca en
 * yüksek çubukta doğrudan etiket; hover/klavye ile çubuk başına ipucu; katlanır veri tablosu.
 */
export function BarChart({ title, labels, longLabels, values, valueLabel, height = 180, format = fmtInt, tickFormat, tableCaption, emptyText, allLabels }: BarChartProps) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const id = useId()
  const n = values.length
  if (n === 0 || !values.some((v) => v > 0)) return <ChartEmpty text={emptyText} height={height} />

  const max = Math.max(0, ...values)
  const ticks = niceTicks(max, 3)
  const top = ticks[ticks.length - 1]
  const tick = tickFormat ?? axisFormatter(top)
  const innerW = Math.max(10, width - PAD_L - PAD_R)
  const innerH = height - PAD_T - PAD_B
  const slot = innerW / n
  const barW = Math.max(1, Math.min(24, slot - 2))
  const x = (i: number) => PAD_L + i * slot + (slot - barW) / 2
  const y = (v: number) => PAD_T + innerH - (top > 0 ? (v / top) * innerH : 0)
  const baseline = PAD_T + innerH
  const maxIndex = values.indexOf(max)
  const xTicks = allLabels ? labels.map((_, i) => i) : pickTickIndexes(n, Math.max(2, Math.floor(innerW / 44)))
  const long = longLabels ?? labels

  function barPath(i: number): string {
    const v = values[i]
    if (!(v > 0)) return ''
    const h = baseline - y(v)
    const r = Math.min(4, barW / 2, h)
    const x0 = x(i)
    return `M${x0} ${baseline} V${baseline - h + r} a${r} ${r} 0 0 1 ${r} -${r} h${barW - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} V${baseline} Z`
  }

  function onMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const idx = Math.floor(((e.clientX - rect.left) / rect.width) * n)
    setActive(Math.max(0, Math.min(n - 1, idx)))
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const next = stepIndex(e.key, active, n)
    if (next === undefined) return
    e.preventDefault()
    setActive(next)
  }

  const total = values.reduce((a, b) => a + b, 0)
  const aria = `${title}: ${n} kova, toplam ${format(total)}, en yüksek ${long[maxIndex]} (${format(max)}).`

  return (
    <div className={s.root}>
      <div ref={ref} className={s.focusable} tabIndex={0} role="group" aria-label={title} aria-describedby={`${id}-d`} onKeyDown={onKey} onBlur={() => setActive(null)} style={{ position: 'relative', minHeight: height }}>
        <span id={`${id}-d`} className="sr-only">
          {aria}
        </span>
        {width > 0 ? (
          <svg className={s.svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={title}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD_L} x2={PAD_L + innerW} y1={y(t)} y2={y(t)} className={t === 0 ? s.axisLine : s.gridLine} />
                <text x={PAD_L - 8} y={y(t)} dy="0.35em" textAnchor="end" className={s.tick}>
                  {tick(t)}
                </text>
              </g>
            ))}
            {values.map((v, i) => (v > 0 ? <path key={i} d={barPath(i)} fill={toneFill.ink} className={[s.bar, active === i ? s.barActive : ''].join(' ')} /> : null))}
            {n <= 40 && barW >= 6 ? (
              <text x={Math.min(Math.max(x(maxIndex) + barW / 2, PAD_L + 14), PAD_L + innerW - 14)} y={y(max) - 5} textAnchor="middle" className={s.capLabel}>
                {format(max)}
              </text>
            ) : null}
            {xTicks.map((i) => (
              <text key={i} x={x(i) + barW / 2} y={baseline + 16} textAnchor="middle" className={s.tick}>
                {labels[i]}
              </text>
            ))}
            <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} className={s.hit} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)} />
          </svg>
        ) : null}
        {active != null && width > 0 ? (
          <ChartTooltip x={x(active) + barW / 2} y={PAD_T} flip={x(active) > width / 2}>
            <div className={s.tipTitle}>{long[active]}</div>
            <TipRow value={format(values[active])} label={valueLabel} />
          </ChartTooltip>
        ) : null}
      </div>
      {tableCaption ? <DataDetails caption={tableCaption} head={['', valueLabel]} rows={values.map((v, i) => [long[i], format(v)])} /> : null}
    </div>
  )
}
