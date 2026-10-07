import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ChartEmpty, ChartTooltip, DataDetails, Legend, TipRow } from './ChartShell'
import { axisFormatter, fmtDayLong, fmtDayShort, fmtInt, niceTicks, pickTickIndexes, stepIndex, toneFill, type ChartTone } from './chartUtils'
import { useMeasure } from './useMeasure'
import s from './charts.module.css'

export interface LineSeries {
  key: string
  label: string
  values: number[]
  tone?: ChartTone
  /** Çizginin altını %8 opak dolgu ile boya (tek seri ya da öne çıkan seri için). */
  area?: boolean
}

interface LineChartProps {
  /** Erişilebilir ad (role="img" aria-label). */
  title: string
  /** 'YYYY-MM-DD' — her seri aynı uzunlukta. */
  dates: string[]
  series: LineSeries[]
  height?: number
  /** İpucu/tablo değer biçimi. */
  format?: (n: number) => string
  /** Y ekseni etiketi biçimi (verilmezse üst değere göre tam sayı ya da kısa biçim). */
  tickFormat?: (n: number) => string
  /** Verilirse altında katlanır veri tablosu. */
  tableCaption?: string
  emptyText?: string
}

const TONES: ChartTone[] = ['ink', 'soft', 'faint', 'accent']
const PAD_L = 44
const PAD_T = 12
const PAD_B = 24

/**
 * Çoklu seri çizgi grafiği: ortak tek y ekseni, seyrek tarih etiketleri, dikey kılavuz + tek ipucu
 * (her seri aynı anda), uçta doğrudan seri etiketi (çakışırsa lejant + ipucu devralır), ok tuşlarıyla
 * klavye gezinmesi ve katlanır veri tablosu.
 */
export function LineChart({ title, dates, series, height = 220, format = fmtInt, tickFormat, tableCaption, emptyText }: LineChartProps) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const id = useId()
  const n = dates.length
  const hasData = n > 0 && series.some((sr) => sr.values.some((v) => v > 0))

  if (n === 0 || !hasData) return <ChartEmpty text={emptyText} height={height} />

  const max = Math.max(0, ...series.flatMap((sr) => sr.values))
  const ticks = niceTicks(max, 4)
  const top = ticks[ticks.length - 1]
  const tick = tickFormat ?? axisFormatter(top)
  const fills = series.map((sr, i) => toneFill[sr.tone ?? TONES[i % TONES.length]])

  // Uç etiketleri: ≤4 seri, yeterli genişlik ve çakışma yoksa.
  const wantEndLabels = series.length >= 2 && series.length <= 4 && width >= 520
  const labelW = wantEndLabels ? Math.max(...series.map((sr) => sr.label.length)) * 6.2 + 10 : 0
  const padR = 12 + labelW
  const innerW = Math.max(10, width - PAD_L - padR)
  const innerH = height - PAD_T - PAD_B
  const x = (i: number) => PAD_L + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1))
  const y = (v: number) => PAD_T + innerH - (top > 0 ? (v / top) * innerH : 0)
  const baseline = PAD_T + innerH

  let endLabels: { key: string; yPos: number; label: string }[] = []
  if (wantEndLabels) {
    endLabels = series.map((sr) => ({ key: sr.key, yPos: y(sr.values[n - 1] ?? 0), label: sr.label })).sort((a, b) => a.yPos - b.yPos)
    for (let i = 1; i < endLabels.length; i++) if (endLabels[i].yPos - endLabels[i - 1].yPos < 13) endLabels = []
  }

  const xTicks = pickTickIndexes(n, Math.max(2, Math.floor(innerW / 64)))

  function onMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const idx = n === 1 ? 0 : Math.round((px / rect.width) * (n - 1))
    setActive(Math.max(0, Math.min(n - 1, idx)))
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const next = stepIndex(e.key, active, n)
    if (next === undefined) return
    e.preventDefault()
    setActive(next)
  }

  const totals = series.map((sr) => sr.values.reduce((a, b) => a + b, 0))
  const aria = `${title}: ${fmtDayShort(dates[0])} – ${fmtDayShort(dates[n - 1])}. ${series.map((sr, i) => `${sr.label} toplam ${format(totals[i])}`).join(', ')}.`

  return (
    <div className={s.root}>
      {series.length >= 2 ? <Legend line items={series.map((sr, i) => ({ key: sr.key, label: sr.label, fill: fills[i] }))} /> : null}
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
            {xTicks.map((i) => (
              <text key={i} x={x(i)} y={baseline + 16} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className={s.tick}>
                {fmtDayShort(dates[i])}
              </text>
            ))}
            {series.map((sr, si) => {
              const d = sr.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
              return (
                <g key={sr.key}>
                  {sr.area ? <path d={`${d} L${x(n - 1).toFixed(1)} ${baseline} L${x(0).toFixed(1)} ${baseline} Z`} fill={fills[si]} className={s.area} /> : null}
                  <path d={d} stroke={fills[si]} className={s.line} />
                </g>
              )
            })}
            {endLabels.map((l) => (
              <text key={l.key} x={PAD_L + innerW + 8} y={l.yPos} dy="0.35em" className={s.endLabel}>
                {l.label}
              </text>
            ))}
            {active != null ? (
              <g>
                <line x1={x(active)} x2={x(active)} y1={PAD_T} y2={baseline} className={s.crosshair} />
                {series.map((sr, si) => (
                  <circle key={sr.key} cx={x(active)} cy={y(sr.values[active] ?? 0)} r={4} fill={fills[si]} className={s.marker} />
                ))}
              </g>
            ) : null}
            <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} className={s.hit} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)} />
          </svg>
        ) : null}
        {active != null && width > 0 ? (
          <ChartTooltip x={x(active)} y={PAD_T} flip={x(active) > width / 2}>
            <div className={s.tipTitle}>{fmtDayLong(dates[active])}</div>
            {series.map((sr, si) => (
              <TipRow key={sr.key} line swatch={fills[si]} value={format(sr.values[active] ?? 0)} label={sr.label} />
            ))}
          </ChartTooltip>
        ) : null}
      </div>
      {tableCaption ? <DataDetails caption={tableCaption} head={['Tarih', ...series.map((sr) => sr.label)]} rows={dates.map((d, i) => [fmtDayLong(d), ...series.map((sr) => format(sr.values[i] ?? 0))])} /> : null}
    </div>
  )
}
