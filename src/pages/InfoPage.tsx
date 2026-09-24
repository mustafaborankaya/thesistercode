import { useParams } from 'react-router-dom'
import { FaqPage } from '../components/info/FaqPage'
import { ContentText } from '../components/ui/ContentText'
import { infoPageBySlug } from '../data/content'
import { NotFoundPage } from './NotFoundPage'
import styles from './Page.module.css'

/** Bilgi sayfaları: içerik kesinleşene kadar her bölüm alan adıyla gösterilir. */
export function InfoPage() {
  const { slug } = useParams()
  const page = slug ? infoPageBySlug[slug] : undefined
  if (!page) return <NotFoundPage />
  if (page.slug === 'sss') return <FaqPage page={page} />
  return (
    <div className={[styles.page, styles.narrow].join(' ')}>
      <h1 className={styles.title}>{page.title}</h1>
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
