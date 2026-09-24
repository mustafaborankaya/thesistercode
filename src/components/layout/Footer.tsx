import { Link } from 'react-router-dom'
import { siteSettings } from '../../config/settings'
import { footerGroups, type FooterLink } from '../../data/content'
import { useIsDesktop, useReducedMotion } from '../../hooks/useMediaQuery'
import { S } from '../../i18n'
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

export function Footer() {
  const isDesktop = useIsDesktop()
  const reduced = useReducedMotion()
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
        <div className={styles.locale}>{S.footer.languageCurrency(S.footer.languageLabel, siteSettings.currency.symbol)}</div>
      </div>

      <div className={styles.bottom}>
        <span className={styles.copy}>{S.footer.copyright(year)}</span>
        <div className={styles.bottomLinks}>
          <Link to="/bilgi/gizlilik" className={styles.bottomLink}>
            Gizlilik
          </Link>
          <Link to="/bilgi/alisveris-kosullari" className={styles.bottomLink}>
            Alışveriş Koşulları
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
