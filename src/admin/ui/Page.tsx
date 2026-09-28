import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AS } from '../adminStrings'
import { AdminIcon, type AdminIconName } from './AdminIcon'
import { Btn } from './Button'
import s from './ui.module.css'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  meta?: ReactNode
}

/** Sayfa başlığı + açıklama + sağda eylem düğmeleri. */
export function PageHeader({ title, description, actions, back, meta }: PageHeaderProps) {
  return (
    <div className={s.pageHeader}>
      <div style={{ minWidth: 0 }}>
        {back ? (
          <Link to={back.to} className={s.pageBack}>
            <AdminIcon name="chevron-left" size={16} />
            {back.label}
          </Link>
        ) : null}
        <div className={s.row} style={{ gap: 10 }}>
          <h1 className={s.pageTitle}>{title}</h1>
          {meta}
        </div>
        {description ? <p className={s.pageDesc}>{description}</p> : null}
      </div>
      {actions ? <div className={s.pageActions}>{actions}</div> : null}
    </div>
  )
}

interface EmptyStateProps {
  icon?: AdminIconName
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon = 'info', title, text, action }: EmptyStateProps) {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}>
        <AdminIcon name={icon} size={22} />
      </span>
      <div className={s.emptyTitle}>{title}</div>
      {text ? <div className={s.emptyText}>{text}</div> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  )
}

/** Uç nokta henüz sunucuda yok (404/501) — sayfa çökmez, bu boş durum gösterilir. */
export function UnavailableState({ feature }: { feature: string }) {
  return (
    <div className={s.card}>
      <EmptyState icon="refresh" title={AS.ui.unavailableTitle} text={AS.ui.unavailableText(feature)} />
    </div>
  )
}

/** Yükleme hatası + Tekrar dene. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={s.card}>
      <EmptyState
        icon="alert"
        title={AS.ui.loadErrorTitle}
        text={message}
        action={
          onRetry ? (
            <Btn icon="refresh" onClick={onRetry}>
              {AS.common.retry}
            </Btn>
          ) : null
        }
      />
    </div>
  )
}

type NoticeTone = 'neutral' | 'warning' | 'danger' | 'success' | 'plain'

export function Notice({ tone = 'neutral', icon, children, action }: { tone?: NoticeTone; icon?: AdminIconName; children: ReactNode; action?: ReactNode }) {
  const toneClass = tone === 'warning' ? s.noticeWarning : tone === 'danger' ? s.noticeDanger : tone === 'success' ? s.noticeSuccess : tone === 'neutral' ? s.noticeNeutral : ''
  const ic: AdminIconName = icon ?? (tone === 'warning' || tone === 'danger' ? 'alert' : tone === 'success' ? 'check' : 'info')
  return (
    <div className={[s.notice, toneClass].join(' ')} role={tone === 'danger' ? 'alert' : undefined}>
      <AdminIcon name={ic} size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {action}
    </div>
  )
}
