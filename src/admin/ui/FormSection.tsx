import type { ReactNode } from 'react'
import s from './ui.module.css'

interface FormSectionProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  /** Gövde dolgusuz (tablo/liste içerikleri için). */
  flush?: boolean
  id?: string
}

/** Başlıklı kart bölüm — ayarlar grupları, ürün formu blokları, drawer dışı detaylar. */
export function FormSection({ title, description, actions, children, flush, id }: FormSectionProps) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section className={s.section} aria-labelledby={headingId} id={id}>
      {title ? (
        <div className={s.sectionHead}>
          <div style={{ minWidth: 0 }}>
            <h2 className={s.sectionTitle} id={headingId}>
              {title}
            </h2>
            {description ? <p className={s.sectionDesc}>{description}</p> : null}
          </div>
          {actions ? <div className={s.pageActions}>{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? s.sectionBodyFlush : s.sectionBody}>{children}</div>
    </section>
  )
}
