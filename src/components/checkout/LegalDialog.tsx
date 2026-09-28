import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { infoPageBySlug } from '../../data/content'
import { S } from '../../i18n'
import { Icon } from '../ui/Icon'
import { LegalText, hasLegalMarkup } from '../ui/LegalText'
import styles from './LegalDialog.module.css'

export type LegalSlug = 'on-bilgilendirme-formu' | 'mesafeli-satis-sozlesmesi' | 'teslimat-ve-iade'

interface LegalDialogProps {
  slug: LegalSlug
  onClose: () => void
}

/**
 * Ödeme adımında "okudum, kabul ediyorum" bağlantılarından açılan sözleşme penceresi:
 * müşteri sayfadan ayrılmadan Ön Bilgilendirme Formu'nu ve Mesafeli Satış Sözleşmesi'ni okur.
 */
export function LegalDialog({ slug, onClose }: LegalDialogProps) {
  const page = infoPageBySlug[slug]
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previous?.focus?.()
    }
  }, [onClose])

  if (!page) return null

  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {page.title}
          </h2>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label={S.common.close}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className={styles.body}>
          {page.sections.map((s, i) => (
            <section key={`${slug}-${i}`} className={styles.section}>
              {page.sections.length > 1 ? <h3 className={styles.sectionTitle}>{s.label}</h3> : null}
              {s.value ? hasLegalMarkup(s.value) ? <LegalText text={s.value} /> : <p style={{ whiteSpace: 'pre-line' }}>{s.value}</p> : <p className="text-soft">{S.info.pendingField(s.label)}</p>}
            </section>
          ))}
        </div>
        <div className={styles.foot}>
          <Link to={`/bilgi/${slug}`} className="link" target="_blank" rel="noopener">
            {S.checkout.openInNewTab}
          </Link>
          <button type="button" className={styles.done} onClick={onClose}>
            {S.common.close}
          </button>
        </div>
      </div>
    </div>
  )
}
