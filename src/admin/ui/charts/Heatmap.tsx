import { useId, useState, type KeyboardEvent } from 'react'
import { ChartEmpty, ChartTooltip, DataDetails, TipRow } from './ChartShell'
import { fmtInt } from './chartUtils'
import { useMeasure } from './useMeasure'
import s from './charts.module.css'

interface HeatmapProps {
  title: string
  rowLabels: string[]
  rowLongLabels?: string[]
  colLabels: string[]
  colLongLabels?: string[]
  /** rows × cols */
  values: number[][]
  valueLabel: string
  format?: (n: number) => string
  tableCaption?: string
  emptyText?: string
  lessLabel?: string
  moreLabel?: string
}

const PAD_L = 34
const PAD_T = 2
const PAD_B = 18
const GAP = 2
const CELL_H = 16

/** Hücre tonu: 0 → neredeyse yüzey; en yüksek → tam mürekkep (tek ton, açıktan koyuya). */
function cellOpacity(v: number, max: number): number {
  if (!(v > 0) || !(max > 0)) return 0.05
  return 0.14 + 0.86 * Math.pow(v / max, 0.65)
}

/**
 * Isı haritası (7 gün × 24 saat): hücre tonu sayısal büyüklüğü taşır (sıralı tek ton rampası), hover ya da
 * ok tuşlarıyla hücre ipucu, altta ölçek lejantı ve katlanır veri tablosu.
 */
export function Heatmap({ title, rowLabels, rowLongLabels, colLabels, colLongLabels, values, valueLabel, format = fmtInt, tableCaption, emptyText, lessLabel = 'Az', moreLabel = 'Çok' }: HeatmapProps) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [active, setActive] = useState<{ r: number; c: number } | null>(null)
  const id = useId()
  const rows = rowLabels.length
  const cols = colLabels.length
  const max = Math.max(0, ...values.flat())
  const height = PAD_T + rows * (CELL_H + GAP) - GAP + PAD_B
  if (rows === 0 || cols === 0 || max === 0) return <ChartEmpty text={emptyText} height={height} />

  const innerW = Math.max(10, width - PAD_L - 4)
  const cellW = Math.max(4, (innerW - GAP * (cols - 1)) / cols)
  const x = (c: number) => PAD_L + c * (cellW + GAP)
  const y = (r: number) => PAD_T + r * (CELL_H + GAP)
  const colEvery = cellW < 22 ? 3 : 1
  const rowLong = rowLongLabels ?? rowLabels
  const colLong = colLongLabels ?? colLabels

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const cur = active ?? { r: 0, c: -1 }
    let next: { r: number; c: number } | null = cur
    switch (e.key) {
      case 'ArrowRight':
        next = { r: cur.r, c: Math.min(cols - 1, cur.c + 1) }
        break
      case 'ArrowLeft':
        next = { r: cur.r, c: Math.max(0, cur.c - 1) }
        break
      case 'ArrowDown':
        next = { r: Math.min(rows - 1, cur.r + 1), c: Math.max(0, cur.c) }
        break
      case 'ArrowUp':
        next = { r: Math.max(0, cur.r - 1), c: Math.max(0, cur.c) }
        break
      case 'Home':
        next = { r: cur.r, c: 0 }
        break
      case 'End':
        next = { r: cur.r, c: cols - 1 }
        break
      case 'Escape':
        next = null
        break
      default:
        return
    }
    e.preventDefault()
    setActive(next)
  }

  const peak = values.reduce<{ r: number; c: number; v: number }>((best, row, r) => row.reduce((b, v, c) => (v > b.v ? { r, c, v } : b), best), { r: 0, c: 0, v: -1 })
  const aria = `${title}: en yoğun ${rowLong[peak.r]} ${colLong[peak.c]} (${format(peak.v)}).`

  return (
    <div className={s.root}>
      <div ref={ref} className={s.focusable} tabIndex={0} role="group" aria-label={title} aria-describedby={`${id}-d`} onKeyDown={onKey} onBlur={() => setActive(null)} style={{ position: 'relative', minHeight: height }}>
        <span id={`${id}-d`} className="sr-only">
          {aria}
        </span>
        {width > 0 ? (
          <svg className={s.svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={title} onPointerLeave={() => setActive(null)}>
            {rowLabels.map((lab, r) => (
              <text key={lab} x={PAD_L - 8} y={y(r) + CELL_H / 2} dy="0.35em" textAnchor="end" className={s.tick}>
                {lab}
              </text>
            ))}
            {colLabels.map((lab, c) =>
              c % colEvery === 0 ? (
                <text key={lab} x={x(c) + cellW / 2} y={height - 4} textAnchor="middle" className={s.tickFaint}>
                  {lab}
                </text>
              ) : null,
            )}
            {values.map((row, r) =>
              row.map((v, c) => (
                <rect
                  key={`${r}-${c}`}
                  x={x(c)}
                  y={y(r)}
                  width={cellW}
                  height={CELL_H}
                  rx={2}
                  fillOpacity={cellOpacity(v, max)}
                  className={[s.cell, active && active.r === r && active.c === c ? s.cellActive : ''].join(' ')}
                  onPointerEnter={() => setActive({ r, c })}
                />
              )),
            )}
          </svg>
        ) : null}
        {active && width > 0 ? (
          <ChartTooltip x={x(active.c) + cellW / 2} y={y(active.r) + CELL_H + 4} flip={x(active.c) > width / 2}>
            <div className={s.tipTitle}>
              {rowLong[active.r]} · {colLong[active.c]}
            </div>
            <TipRow value={format(values[active.r][active.c])} label={valueLabel} />
          </ChartTooltip>
        ) : null}
      </div>
      <div className={s.scale} aria-hidden="true">
        {lessLabel}
        <span className={s.scaleSteps}>
          {[0.05, 0.3, 0.5, 0.72, 1].map((o) => (
            <span key={o} className={s.scaleStep} style={{ opacity: o }} />
          ))}
        </span>
        {moreLabel}
      </div>
      {tableCaption ? <DataDetails caption={tableCaption} head={['', ...colLabels]} rows={values.map((row, r) => [rowLong[r], ...row.map((v) => format(v))])} /> : null}
    </div>
  )
}
