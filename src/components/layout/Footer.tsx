import { Link } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { brandContent, footerGroups, usePreviewVersion, type FooterLink } from '../../data/content'
import { useIsDesktop, useReducedMotion } from '../../hooks/useMediaQuery'
import { S, locale, pathForLocale } from '../../i18n'
import { usePanels } from '../../state/PanelContext'
import { AccordionItem } from '../ui/Accordion'
import { Icon } from '../ui/Icon'
import styles from './Footer.module.css'

function FooterLinkItem({ link }: { link: FooterLink }) {
  const { openPanel } = usePanels()
  if (link.action) {
    const panel = link.action === 'cookie-preferences' ? 'cookie-preferences' : link.action === 'discount-offer' ? 'offer' : 'support'
    return (
      <button type="button" className={styles.link} onClick={() => openPanel(panel)}>
        {link.label}
      </button>
    )
  }
  return (
    <Link to={link.to ?? '/'} className={styles.link}>
      {link.label}
    </Link>
  )
}

/** Altbilgideki yasal satırın içerik anahtarları (panel önizlemesi: şirket unvanı / adres / sicil). */
const LEGAL_KEYS = [brandContent.companyName.key, brandContent.address.key, brandContent.registry.key].filter(Boolean).join(' ')

export function Footer() {
  const isDesktop = useIsDesktop()
  const reduced = useReducedMotion()
  // Panel önizlemesinde taslak metin değişince yeniden çizilsin.
  usePreviewVersion()
  const year = new Date().getFullYear()
  const socials = Object.entries(siteSettings.social) as [string, string | null][]

  return (
    <footer className={styles.footer}>
      {isDesktop ? (
        <div className={styles.groups}>
          {footerGroups.map((g) => (
            <div key={g.id}>
              <h2 className={styles.groupTitle}>{g.title}</h2>
              <ul className={styles.links}>
                {g.links.map((l) => (
                  <li key={l.label}>
                    <FooterLinkItem link={l} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.accordion}>
          {footerGroups.map((g) => (
            <AccordionItem key={g.id} title={g.title}>
              <ul className={styles.links}>
                {g.links.map((l) => (
                  <li key={l.label}>
                    <FooterLinkItem link={l} />
                  </li>
                ))}
              </ul>
            </AccordionItem>
          ))}
        </div>
      )}

      <div className={styles.meta}>
        <ul className={styles.social} aria-label="Sosyal medya">
          {socials.map(([name, url]) => {
            const label = name.charAt(0).toUpperCase() + name.slice(1)
            const icon = name as 'instagram' | 'tiktok' | 'pinterest'
            return (
              <li key={name} className={styles.socialItem}>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer noopener" className={styles.socialLink} aria-label={label}>
                    <Icon name={icon} size={20} />
                    <span>{label}</span>
                  </a>
                ) : (
                  <span className={styles.socialLink} title={S.footer.socialPending(label)}>
                    <Icon name={icon} size={20} />
                    <span>{S.footer.socialPending(label)}</span>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        <div className={styles.locale}>
          <span className={styles.langSwitch} role="group" aria-label={S.locale.switchLabel}>
            <a href={pathForLocale('tr')} aria-current={locale === 'tr' ? 'true' : undefined} lang="tr" hrefLang="tr">
              {S.locale.tr}
            </a>
            <span aria-hidden="true">|</span>
            <a href={pathForLocale('en')} aria-current={locale === 'en' ? 'true' : undefined} lang="en" hrefLang="en">
              {S.locale.en}
            </a>
          </span>
          <span aria-hidden="true">·</span>
          <span>{siteSettings.currency.symbol}</span>
        </div>
      </div>

      <div className={styles.payment}>
        <span className={styles.payLabel}>{S.footer.securePayment}</span>
        <img src="/logos/iyzico-kart-bandi.svg" alt={S.checkout.securePaymentAlt} className={styles.payLogos} width={429} height={32} loading="lazy" />
      </div>

      {brandContent.companyName.value ? (
        <p className={styles.legal} data-content-key={LEGAL_KEYS}>
          {[brandContent.companyName.value, brandContent.address.value, brandContent.registry.value].filter(Boolean).join(' · ')}
        </p>
      ) : null}

      <div className={styles.bottom}>
        <span className={styles.copy}>
          {S.footer.copyright(year)}
          {siteSettings.demo.enabled ? (
            <span className={styles.demo} title={S.common.demoBar}>
              {S.common.demoShort}
            </span>
          ) : null}
        </span>
        <div className={styles.bottomLinks}>
          <Link to="/bilgi/gizlilik" className={styles.bottomLink}>
            {S.footer.privacy}
          </Link>
          <Link to="/bilgi/mesafeli-satis-sozlesmesi" className={styles.bottomLink}>
            {S.footer.terms}
          </Link>
          <FooterLinkItem link={{ label: S.cookie.title, action: 'cookie-preferences' }} />
        </div>
        <button type="button" className={styles.top} onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}>
          <Icon name="arrow-up" size={14} />
          {S.footer.backToTop}
        </button>
      </div>
    </footer>
  )
}
