import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AdminIcon, type AdminIconName } from './AdminIcon'
import s from './ui.module.css'

interface KpiCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: AdminIconName
  /** Dikkat gerektiren göstergeler için küçük renk noktası (ör. düşük stok > 0 → uyarı). */
  tone?: 'warning' | 'danger' | 'success'
  to?: string
  loading?: boolean
  /** Değerin altında küçük değişim metni (ör. "▲ %12,5" — önceki döneme göre). */
  delta?: ReactNode
  /** Sağ altta küçük eğilim grafiği (Sparkline); dekoratiftir, değeri kart metni taşır. */
  trend?: ReactNode
}

const toneColor = { warning: 'var(--a-warning)', danger: 'var(--a-danger)', success: 'var(--a-success)' }

export function KpiCard({ label, value, sub, icon, tone, to, loading, delta, trend }: KpiCardProps) {
  const main = (
    <>
      <span className={s.kpiValue}>{loading ? <span className={s.skeleton} style={{ width: 72, height: 22 }} /> : value}</span>
      {delta && !loading ? <span className={s.kpiDelta}>{delta}</span> : null}
    </>
  )
  const body = (
    <>
      <span className={s.kpiLabel}>
        {icon ? <AdminIcon name={icon} size={16} /> : null}
        {label}
        {tone ? <span className={s.kpiTone} style={{ background: toneColor[tone] }} aria-hidden="true" /> : null}
      </span>
      {trend ? (
        <span className={s.kpiMain}>
          <span className={s.kpiMainText}>{main}</span>
          {loading ? null : <span className={s.kpiTrend}>{trend}</span>}
        </span>
      ) : (
        main
      )}
      {sub ? <span className={s.kpiSub}>{loading ? <span className={s.skeleton} style={{ width: 96 }} /> : sub}</span> : null}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={s.kpi}>
        {body}
      </Link>
    )
  }
  return <div className={s.kpi}>{body}</div>
}
