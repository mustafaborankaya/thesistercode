import { Link } from 'react-router-dom'
import { cookieContent } from '../../data/content'
import { S } from '../../i18n'
import { useConsent } from '../../state/ConsentContext'
import { usePanels } from '../../state/PanelContext'
import { Button } from '../ui/Button'
import styles from './Panels.module.css'

/**
 * İlk ziyarette alt kenarda görünen çerez çubuğu. Karar verilince (kabul / gerekli / tercih kaydı) bir daha
 * sorulmaz; footer "Çerez Tercihleri" tercih panelini yeniden açar. Gerçek politika metni gelene kadar
 * demo kapsamına uygun kısa açıklama gösterilir (uydurma yasal metin yok).
 */
export function CookieBanner() {
  const { consent, acceptAll, necessaryOnly } = useConsent()
  const { openPanel, isOpen } = usePanels()
  if (consent.status !== 'pending') return null
  if (isOpen('cookie-preferences')) return null

  return (
    <section className={styles.cookieBar} role="region" aria-label={S.cookie.title} data-cookie-banner>
      <div className={styles.cookieBody}>
        <h2 className={styles.cookieTitle}>{S.cookie.title}</h2>
        <p className={styles.cookieText}>
          {cookieContent.bannerText.value ?? S.cookie.demoText}{' '}
          <Link to="/bilgi/cerez-politikasi" className="link">
            {S.cookie.policyLink}
          </Link>
        </p>
      </div>
      <div className={styles.cookieActions}>
        <Button variant="ghost" small onClick={() => openPanel('cookie-preferences')}>
          {S.cookie.preferences}
        </Button>
        <Button variant="secondary" small onClick={necessaryOnly}>
          {S.cookie.necessaryOnly}
        </Button>
        <Button variant="primary" small onClick={acceptAll}>
          {S.cookie.acceptAll}
        </Button>
      </div>
    </section>
  )
}
