import { Link } from 'react-router-dom'
import { infoPageBySlug } from '../../data/content'
import { S } from '../../i18n'
import styles from './InfoBlock.module.css'

const slugs = ['teslimat', 'iade-degisim', 'beden-rehberi', 'sss'] as const

/** Sade bilgilendirme satırı: Teslimat, İade/Değişim, Beden Rehberi, SSS için ince çerçeveli 4 küçük bağlantı kutusu. */
export function InfoBlock() {
  return (
    <section className={styles.section} aria-label={S.common.infoBlockLabel}>
      <ul className={styles.grid}>
        {slugs.map((slug) => {
          const page = infoPageBySlug[slug]
          return (
            <li key={slug} className={styles.item}>
              <Link to={`/bilgi/${slug}`} className={styles.link}>
                <span className={styles.itemTitle}>{page.title}</span>
                <span className={styles.itemNote}>{S.common.fieldPending}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
