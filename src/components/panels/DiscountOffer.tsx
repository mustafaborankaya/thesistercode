import { useCallback, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { S } from '../../i18n'
import { useAccount } from '../../state/AccountContext'
import { useConsent } from '../../state/ConsentContext'
import { usePanels } from '../../state/PanelContext'
import { Button, IconButton } from '../ui/Button'
import { MAX_AUTO_SHOWS, readOfferState, writeOfferState } from './offerState'
import styles from './Panels.module.css'

/** Teklifin kendiliğinden açılmayacağı yollar (form doldurma, sepet, ödeme, hesap). */
const BLOCKED_PATHS = ['/odeme', '/giris', '/kayit', '/hesap', '/sepet']

function onBlockedPath(pathname: string): boolean {
  return BLOCKED_PATHS.some((p) => pathname.startsWith(p))
}

function isTypingInForm(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * "Hesap oluştur, %10 indirim kazan." teklif paneli.
 * - Çerez kararından sonra, başka panel açık değilken ve form/sepet/ödeme dışındayken gecikmeli açılır.
 * - Yalnızca X/Escape ile kapatma veya "Hesap Oluştur"a geçiş "reddedildi" sayılır; başka panel/rota nedeniyle
 *   kesilen teklif uygun ekrana dönülünce (en fazla MAX_AUTO_SHOWS kez) yeniden sunulur.
 * - Hesabı olan kullanıcıya kendiliğinden teklif edilmez; footer/üst şeritten elle her zaman açılabilir.
 */
export function DiscountOffer() {
  const { isOpen, openPanel, closePanel, open } = usePanels()
  const { consent } = useConsent()
  const { isLoggedIn } = useAccount()
  const location = useLocation()
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const autoOpenedRef = useRef(false)
  const visible = isOpen('offer')
  const campaign = siteSettings.memberDiscount

  const dismiss = useCallback(() => {
    writeOfferState({ dismissed: true })
    closePanel('offer')
  }, [closePanel])

  // Otomatik gösterim zamanlaması — koşullar her değiştiğinde yeniden değerlendirilir.
  useEffect(() => {
    if (!campaign.enabled || consent.status !== 'decided' || isLoggedIn) return
    if (onBlockedPath(location.pathname)) return
    if (open !== null) return // başka panel açık — kapanınca bu efekt yeniden çalışır
    const state = readOfferState()
    if (state.dismissed || state.autoShown >= MAX_AUTO_SHOWS) return

    let timer = 0
    const attempt = () => {
      if (isTypingInForm() || onBlockedPath(window.location.pathname)) {
        timer = window.setTimeout(attempt, siteSettings.offerPanel.retryMs)
        return
      }
      const current = readOfferState()
      if (current.dismissed || current.autoShown >= MAX_AUTO_SHOWS) return
      writeOfferState({ autoShown: current.autoShown + 1 })
      autoOpenedRef.current = true
      openPanel('offer')
    }
    timer = window.setTimeout(attempt, siteSettings.offerPanel.delayAfterConsentMs)
    return () => window.clearTimeout(timer)
  }, [campaign.enabled, consent.status, isLoggedIn, location.pathname, open, openPanel])

  // Escape ile kapanma; elle açıldıysa odağı panele ver (otomatik açılışta odak çalınmaz)
  useEffect(() => {
    if (!visible) {
      autoOpenedRef.current = false
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', onKey)
    if (!autoOpenedRef.current) panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [visible, dismiss])

  if (!visible || !campaign.enabled) return null

  return (
    <div ref={panelRef} className={styles.offer} role="dialog" aria-labelledby="offer-title" aria-describedby="offer-text" tabIndex={-1} data-discount-offer>
      <div className={styles.offerHead}>
        <div>
          <p className={styles.offerEyebrow}>{S.account.offerEyebrow}</p>
          <h2 id="offer-title" className={styles.offerTitle}>
            {isLoggedIn ? S.account.alreadyMember : S.account.offerTitle}
          </h2>
        </div>
        <IconButton icon="close" label={S.account.offerClose} onClick={dismiss} className={styles.offerClose} />
      </div>
      <p id="offer-text" className={styles.offerText}>
        {isLoggedIn ? S.account.discountActive(campaign.percent) : S.account.offerText}
      </p>
      {isLoggedIn ? (
        <Link to="/hesap" className="link text-sm" onClick={dismiss}>
          {S.account.title}
        </Link>
      ) : (
        <div className={styles.offerActions}>
          <Button
            variant="primary"
            block
            onClick={() => {
              dismiss()
              navigate('/kayit')
            }}
          >
            {S.account.offerButton}
          </Button>
          <Link to="/giris" className={styles.offerLogin} onClick={() => closePanel('offer')}>
            {S.account.offerHaveAccount}
          </Link>
        </div>
      )}
      <p className={styles.offerNote}>{S.account.offerDemoNote}</p>
    </div>
  )
}
