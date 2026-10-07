import type { ReactNode } from 'react'
import { AS } from '../../adminStrings'
import s from './charts.module.css'

/** Hover/klavye ipucu — HTML katmanında (SVG metin kırpılmaz). `aria-live` ile ekran okuyucuya duyurulur. */
export function ChartTooltip({ x, y, flip, children }: { x: number; y: number; flip: boolean; children: ReactNode }) {
  return (
    <div className={[s.tooltip, flip ? s.tooltipFlip : ''].join(' ')} style={{ left: x, top: y }} role="status" aria-live="polite">
      {children}
    </div>
  )
}

/** İpucu satırı: değer önde (vurgulu), seri adı arkada; kimlik yanındaki kısa çizgi/kare ile. */
export function TipRow({ swatch, value, label, line }: { swatch?: string; value: ReactNode; label: ReactNode; line?: boolean }) {
  return (
    <div className={s.tipRow}>
      {swatch ? <span className={line ? s.tipLine : s.tipSwatch} style={{ background: swatch }} aria-hidden="true" /> : null}
      <strong className={s.tipValue}>{value}</strong>
      <span className={s.tipLabel}>{label}</span>
    </div>
  )
}

/** Her grafiğin erişilebilir ikizi: katlanır veri tablosu. */
export function DataDetails({ caption, head, rows, align = 'right' }: { caption: string; head: string[]; rows: (string | number)[][]; align?: 'right' | 'left' }) {
  return (
    <details className={s.details}>
      <summary className={s.summary}>{AS.analytics.dataTable}</summary>
      <div className={s.detailsScroll}>
        <table className={s.table}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col" className={i === 0 ? s.cellLeft : align === 'left' ? s.cellLeft : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (ci === 0 ? <th key={ci} scope="row" className={s.cellLeft}>{c}</th> : <td key={ci} className={align === 'left' ? s.cellLeft : undefined}>{c}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/** Boş/0 veri için sakin boş durum. */
export function ChartEmpty({ text, height }: { text?: string; height?: number }) {
  return (
    <div className={s.emptyBox} style={height ? { minHeight: height } : undefined}>
      {text ?? AS.analytics.empty}
    </div>
  )
}

/** Lejant — iki ve daha çok seri için her zaman gösterilir (kimlik yalnızca renge bırakılmaz). */
export function Legend({ items, line }: { items: { key: string; label: string; fill: string }[]; line?: boolean }) {
  return (
    <ul className={s.legend} aria-hidden="true">
      {items.map((it) => (
        <li key={it.key} className={s.legendItem}>
          <span className={line ? s.legendLine : s.legendSwatch} style={{ background: it.fill }} />
          {it.label}
        </li>
      ))}
    </ul>
  )
}
