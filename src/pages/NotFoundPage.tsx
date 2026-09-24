import { Button } from '../components/ui/Button'
import { S } from '../i18n'
import styles from './Page.module.css'

export function NotFoundPage() {
  return (
    <div className={[styles.page, styles.narrow].join(' ')}>
      <h1 className={styles.title}>{S.common.notFoundTitle}</h1>
      <p className={styles.lead}>{S.common.notFoundText}</p>
      <div style={{ marginTop: 'var(--sp-6)' }}>
        <Button variant="secondary" to="/">
          {S.common.goHome}
        </Button>
      </div>
    </div>
  )
}
