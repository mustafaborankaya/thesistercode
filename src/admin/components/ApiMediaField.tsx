import { useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { MediaSlot } from '../../components/ui/MediaSlot'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { uploadAdminMedia } from '../adminApi'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

interface ApiMediaFieldProps {
  /** Yüklenen dosyanın sunucudaki temel adı (multer `safeName` ile işlenir) — örn. "urun-01-on" ya da "logo". */
  name: string
  label: string
  src: string | null
  ratio?: string
  kind?: 'image' | 'video'
  accept?: string
  /** Yükleme tamamlanınca dönen URL'yi kalıcı alana (ürün/marka) yazan çağrı — hata fırlatırsa yakalanır. */
  onUpload: (url: string) => Promise<void>
  /**
   * Verilmezse Kaldır düğmesi gösterilmez. Ürün görselleri API'de kaldırılamaz (`mediaSchema` boş/null
   * kabul etmez, bkz. api/src/routes/admin-products.js) — yalnızca marka görselleri (`brand-media`)
   * null ile silinebilir.
   */
  onRemove?: () => Promise<void>
}

/** MediaField'in (localStorage/IndexedDB) API karşılığı — yükleme `POST /admin/upload`'a gider. */
export function ApiMediaField({ name, label, src, ratio = '3 / 4', kind = 'image', accept = 'image/*', onUpload, onRemove }: ApiMediaFieldProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setPending(true)
    setError(null)
    try {
      const res = await uploadAdminMedia(file, name)
      await onUpload(res.url)
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setPending(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!onRemove) return
    setPending(true)
    setError(null)
    try {
      await onRemove()
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.mediaField}>
      <MediaSlot label={label} ratio={ratio} src={src} kind={kind} captionSize="sm" />
      <div className={styles.mediaActions}>
        <Button small variant="secondary" disabled={pending} onClick={() => inputRef.current?.click()}>
          {src ? AS.media.replace : AS.media.upload}
        </Button>
        {src && onRemove ? (
          <Button small variant="ghost" disabled={pending} onClick={() => void handleRemove()}>
            {AS.media.remove}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className={styles.mediaNotice} role="alert">
          {error}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
    </div>
  )
}
