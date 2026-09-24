import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { InfoPageDef } from '../../data/content'
import { S } from '../../i18n'
import { ContentText } from '../ui/ContentText'
import { Icon } from '../ui/Icon'
import { parseFaq, type FaqItem } from './parseFaq'
import pageStyles from '../../pages/Page.module.css'
import styles from './FaqPage.module.css'

/** Bölüm bağlantı adları (URL hash'i): `/bilgi/sss#teslimat`. Dile göre değişmez, sıra content.ts ile aynı. */
const SECTION_IDS = ['siparis', 'teslimat', 'iade', 'uyelik']

/** Tek soru: büyük başlık düğmesi + yumuşak açılan cevap alanı. */
function FaqQuestion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const triggerId = `${id}-q`
  const panelId = `${id}-a`
  return (
    <div className={styles.item} data-open={open || undefined}>
      <h3 className={styles.qHeading}>
        <button type="button" id={triggerId} className={styles.trigger} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
          <span className={styles.qText}>{item.question}</span>
          <Icon name="plus" size={22} className={styles.icon} aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={triggerId} className={styles.panel} inert={!open}>
        <div className={styles.panelClip}>
          <div className={styles.answer}>
            {item.answer.length ? item.answer.map((p, i) => <p key={i}>{p}</p>) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/** `/bilgi/sss`: bölümlere ayrılmış, animasyonlu akordeon. Metinler panelden `S:`/`C:` düz metin biçiminde gelir. */
export function FaqPage({ page }: { page: InfoPageDef }) {
  const sections = useMemo(
    () =>
      page.sections.map((field, i) => ({
        field,
        id: SECTION_IDS[i] ?? `bolum-${i + 1}`,
        parsed: parseFaq(field.value),
      })),
    [page.sections],
  )
  const hasAny = sections.some((s) => s.parsed.items.length > 0)

  // Hiç soru ayrıştırılamadı: eski düz metin görünümü.
  if (!hasAny) {
    return (
      <div className={[pageStyles.page, pageStyles.narrow].join(' ')}>
        <h1 className={pageStyles.title}>{page.title}</h1>
        <div className="stack">
          {page.sections.map((s) => (
            <section key={s.label}>
              <h2 className="h-block" style={{ marginBottom: 'var(--sp-2)' }}>
                {s.label}
              </h2>
              <ContentText field={s} />
            </section>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={[pageStyles.page, styles.wrap].join(' ')}>
      <header className={styles.head}>
        <h1 className={styles.title}>{page.title}</h1>
        <p className={styles.lead}>{S.info.faqLead}</p>
      </header>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label={S.info.faqSectionsNav}>
          <ul className={styles.navList}>
            {sections.map((s) => (
              <li key={s.id}>
                <Link to={`#${s.id}`} className={styles.navLink}>
                  {s.field.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.content}>
          {sections.map((s) => (
            <section key={s.id} id={s.id} tabIndex={-1} className={styles.section} aria-labelledby={`${s.id}-title`}>
              <h2 id={`${s.id}-title`} className={styles.sectionTitle}>
                {s.field.label}
              </h2>
              {s.parsed.intro.map((p, i) => (
                <p key={i} className={styles.intro}>
                  {p}
                </p>
              ))}
              {s.parsed.items.length ? (
                <div className={styles.list}>
                  {s.parsed.items.map((item, i) => (
                    <FaqQuestion key={`${i}-${item.question}`} item={item} />
                  ))}
                </div>
              ) : s.parsed.intro.length ? null : (
                <ContentText field={s.field} className={styles.intro} />
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
