import type { ReactNode } from 'react'
import { ChartEmpty } from './ChartShell'
import { fmtInt, sharePct } from './chartUtils'
import s from './charts.module.css'

export interface HBarItem {
  key: string
  label: ReactNode
  /** Etiket altında küçük gri ek bilgi (ör. ham yol). */
  sub?: ReactNode
  value: number
  /** Değer metni (verilmezse `format(value)`). */
  valueLabel?: string
  /** Değerin solunda rozet (ör. durum, sonuçsuz arama). */
  badge?: ReactNode
}

interface HBarListProps {
  ariaLabel: string
  items: HBarItem[]
  format?: (n: number) => string
  /** Pay yüzdesi için payda (verilmezse öğelerin toplamı). */
  total?: number
  emptyText?: string
  /** Pay sütununu gizle. */
  hideShare?: boolean
}

/**
 * Yatay sıralı liste: etiket + değer + oran çubuğu. En uzun çubuk en büyük değerdir; yüzde, toplam
 * içindeki paydır. Tüm değerler metin olarak görünür — ipucu gerekmez.
 */
export function HBarList({ ariaLabel, items, format = fmtInt, total, emptyText, hideShare }: HBarListProps) {
  if (items.length === 0 || !items.some((it) => it.value > 0)) return <ChartEmpty text={emptyText} height={80} />
  const max = Math.max(...items.map((it) => it.value))
  const sum = total ?? items.reduce((a, it) => a + it.value, 0)
  return (
    <div className={s.root}>
      <ol className={s.hList} aria-label={ariaLabel}>
        {items.map((it) => (
          <li key={it.key} className={s.hRow}>
            <div className={s.hHead}>
              <span className={s.hLabel}>
                <span className={s.hLabelText}>{it.label}</span>
                {it.sub ? <span className={s.hSub}>{it.sub}</span> : null}
              </span>
              {it.badge ? <span className={s.hBadge}>{it.badge}</span> : null}
              <span className={s.hValue}>{it.valueLabel ?? format(it.value)}</span>
              {hideShare ? null : <span className={s.hShare}>{sharePct(it.value, sum)}</span>}
            </div>
            <div className={s.hTrack} aria-hidden="true">
              <div className={s.hFill} style={{ width: `${max > 0 ? (it.value / max) * 100 : 0}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
