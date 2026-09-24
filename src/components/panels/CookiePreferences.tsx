import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cookieContent } from '../../data/content'
import { S } from '../../i18n'
import { useConsent } from '../../state/ConsentContext'
import { usePanels } from '../../state/PanelContext'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { Switch } from '../ui/Field'
import styles from './Panels.module.css'

/** Gerekli / analitik / pazarlama tercihlerini ayrı yöneten panel; footer'daki "Çerez Tercihleri" ile yeniden açılır. */
export function CookiePreferences() {
  const { isOpen } = usePanels()
  // Panel her açılışta mevcut tercihlerle sıfırdan kurulsun diye iç bileşen yalnızca açıkken mount edilir.
  if (!isOpen('cookie-preferences')) return null
  return <CookiePreferencesDialog />
}

function CookiePreferencesDialog() {
  const { consent, save, acceptAll } = useConsent()
  const { closePanel } = usePanels()
  const [analytics, setAnalytics] = useState(consent.analytics)
  const [marketing, setMarketing] = useState(consent.marketing)
  const close = () => closePanel('cookie-preferences')

  return (
    <Drawer
      open
      onClose={close}
      title={S.cookie.title}
      side="center"
      footer={
        <div className={styles.prefActions}>
          <Button
            variant="primary"
            block
            onClick={() => {
              save({ analytics, marketing })
              close()
            }}
          >
            {S.cookie.save}
          </Button>
          <Button
            variant="secondary"
            block
            onClick={() => {
              acceptAll()
              close()
            }}
          >
            {S.cookie.acceptAll}
          </Button>
        </div>
      }
    >
      <div className={styles.prefList}>
        <p className="text-sm">{cookieContent.bannerText.value ?? S.cookie.demoText}</p>
        {cookieContent.categories.map((c) => (
          <div key={c.id} className={styles.prefItem}>
            {c.required ? (
              <Switch label={c.label} checked disabled readOnly description={c.description.value ?? S.cookie.necessaryDemo} />
            ) : (
              <Switch
                label={c.label}
                checked={c.id === 'analytics' ? analytics : marketing}
                onChange={(e) => (c.id === 'analytics' ? setAnalytics(e.target.checked) : setMarketing(e.target.checked))}
                description={c.description.value ?? (c.id === 'analytics' ? S.cookie.analyticsDemo : S.cookie.marketingDemo)}
              />
            )}
            {c.required ? <div className={styles.prefAlways}>{S.cookie.always}</div> : null}
          </div>
        ))}
        <Link to="/bilgi/cerez-politikasi" className="link text-xs" onClick={close}>
          {S.cookie.policyLink}
        </Link>
      </div>
    </Drawer>
  )
}
