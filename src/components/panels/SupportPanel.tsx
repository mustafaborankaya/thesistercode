import { Link } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { brandContent } from '../../data/content'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { S } from '../../i18n'
import { useConsent } from '../../state/ConsentContext'
import { usePanels } from '../../state/PanelContext'
import { Button } from '../ui/Button'
import { ContentText } from '../ui/ContentText'
import { Drawer } from '../ui/Drawer'
import { Icon } from '../ui/Icon'
import styles from './Panels.module.css'

/** Küçük siyah/beyaz destek kontrolü. Çerez kararı bekliyorken ve %10 teklifi açıkken gösterilmez (aynı alanı paylaşmasınlar). */
export function SupportButton() {
  const { openPanel, isOpen } = usePanels()
  const { consent } = useConsent()
  if (consent.status === 'pending' || isOpen('offer')) return null
  return (
    <button type="button" className={styles.supportBtn} onClick={() => openPanel('support')} aria-expanded={isOpen('support')} aria-label={S.support.open} data-support-button>
      <Icon name="whatsapp" size={24} />
    </button>
  )
}

/** Kısa destek paneli. Gerçek numara tanımlanmadıkça yönlendirme yapmaz. */
export function SupportPanel() {
  const { isOpen, closePanel } = usePanels()
  const isDesktop = useIsDesktop()
  const number = siteSettings.support.whatsappNumber
  const email = siteSettings.support.email
  const close = () => closePanel('support')

  return (
    <Drawer open={isOpen('support')} onClose={close} title={S.support.title} side={isDesktop ? 'right' : 'bottom'}>
      <p className="text-sm" style={{ marginBottom: 'var(--sp-4)' }}>
        {S.support.intro}
      </p>

      <div className={styles.supportBlock}>
        <div className={styles.supportLabel}>
          <Icon name="whatsapp" size={16} /> {S.support.whatsapp}
        </div>
        {number ? (
          <Button variant="primary" onClick={() => window.open(`https://wa.me/${number}`, '_blank', 'noopener')}>
            <Icon name="whatsapp" size={18} />
            {S.support.startChat}
          </Button>
        ) : (
          <div className={styles.supportPending}>
            <Icon name="info" size={16} />
            <span>{S.support.numberPending}</span>
          </div>
        )}
      </div>

      <div className={styles.supportBlock}>
        <div className={styles.supportLabel}>E-posta</div>
        {email ? (
          <a href={`mailto:${email}`} className="link text-sm">
            {email}
          </a>
        ) : (
          <div className={styles.supportPending}>
            <Icon name="info" size={16} />
            <span>{S.support.emailPending}</span>
          </div>
        )}
      </div>

      <div className={styles.supportBlock}>
        <div className={styles.supportLabel}>{brandContent.workingHours.label}</div>
        <ContentText field={brandContent.workingHours} className="text-sm" />
      </div>

      <div className={styles.supportBlock}>
        <div className={styles.supportLinks}>
          <Link to="/bilgi/sss" className={styles.supportLink} onClick={close}>
            <Icon name="chevron-right" size={14} />
            {S.support.faq}
          </Link>
          <Link to="/bilgi/iletisim" className={styles.supportLink} onClick={close}>
            <Icon name="chevron-right" size={14} />
            {S.support.contact}
          </Link>
        </div>
      </div>
    </Drawer>
  )
}
