import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

interface SaveBarProps {
  /** Verilmezse Kaydet düğmesi gösterilmez (yalnızca mesaj/ekstra düğmeler için). */
  onSave?: () => void
  saveLabel?: string
  pending?: boolean
  /** Kaydet/sıfırlama sonrası gösterilecek durum mesajı; null iken gösterilmez. */
  message?: string | null
  /** Kaydet düğmesinin yanına eklenecek diğer düğmeler (Varsayılana dön, Listeye dön). */
  children?: ReactNode
}

/**
 * Ortak "Kaydet" çubuğu: kaydet düğmesi + kaydedince "mağazada görmek için yenileyin" mesajı,
 * "Mağazayı aç" ve "Sayfayı yenile" bağlantıları. Panel katmanı override'ları senkron yazar ama
 * mağaza (catalog/settings/content) modül yüklenirken uygulandığı için tam sayfa yenileme gerekir.
 */
export function SaveBar({ onSave, saveLabel, pending, message, children }: SaveBarProps) {
  return (
    <div className={styles.saveBar}>
      <div className={styles.pageActions}>
        {onSave ? (
          <Button onClick={onSave} disabled={pending}>
            {saveLabel ?? AS.save.save}
          </Button>
        ) : null}
        {children}
      </div>
      {message ? (
        <div className={styles.saveMessage}>
          <Icon name="check" size={16} />
          <span>{message}</span>
          <a className="link" href="/" target="_blank" rel="noopener noreferrer">
            {AS.save.openStore}
          </a>
          <button type="button" className="link" onClick={() => window.location.reload()}>
            {AS.save.reloadPage}
          </button>
        </div>
      ) : null}
    </div>
  )
}
