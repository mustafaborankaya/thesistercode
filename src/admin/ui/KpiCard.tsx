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
}

const toneColor = { warning: 'var(--a-warning)', danger: 'var(--a-danger)', success: 'var(--a-success)' }

export function KpiCard({ label, value, sub, icon, tone, to, loading }: KpiCardProps) {
  const body = (
    <>
      <span className={s.kpiLabel}>
        {icon ? <AdminIcon name={icon} size={16} /> : null}
        {label}
        {tone ? <span className={s.kpiTone} style={{ background: toneColor[tone] }} aria-hidden="true" /> : null}
      </span>
      <span className={s.kpiValue}>{loading ? <span className={s.skeleton} style={{ width: 72, height: 22 }} /> : value}</span>
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
