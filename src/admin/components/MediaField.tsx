import { useRef, useState } from 'react'
import { MediaSlot } from '../../components/ui/MediaSlot'
import { Button } from '../../components/ui/Button'
import { mediaByName } from '../../data/media'
import { deleteMediaBlob, putMediaBlob } from '../adminStore'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

const LARGE_FILE_BYTES = 2 * 1024 * 1024

interface MediaFieldProps {
  /** IndexedDB blob anahtarı — bkz. productMediaName / brandMediaNames. */
  name: string
  label: string
  ratio?: string
  kind?: 'image' | 'video'
  accept?: string
  /** Yükleme/kaldırma tamamlanınca çağrılır — üst sayfa "yenileyin" mesajını göstermek için kullanabilir. */
  onChange?: () => void
}

/**
 * Görsel/video önizleme + yükleme + kaldırma. `mediaOverrideUrls` reaktif olmadığı için
 * yükleme/kaldırma sonrası önizleme kendi bileşen state'inden (`src`) güncellenir.
 */
export function MediaField({ name, label, ratio = '3 / 4', kind = 'image', accept = 'image/*', onChange }: MediaFieldProps) {
  const [src, setSrc] = useState<string | null>(() => mediaByName(name))
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setNotice(file.size > LARGE_FILE_BYTES ? AS.media.largeFile : null)
    setPending(true)
    await putMediaBlob(name, file)
    setSrc(mediaByName(name))
    setPending(false)
    onChange?.()
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleRemove() {
    setPending(true)
    await deleteMediaBlob(name)
    setSrc(mediaByName(name))
    setNotice(null)
    setPending(false)
    onChange?.()
  }

  return (
    <div className={styles.mediaField}>
      <MediaSlot label={label} ratio={ratio} src={src} kind={kind} captionSize="sm" />
      <div className={styles.mediaActions}>
        <Button small variant="secondary" disabled={pending} onClick={() => inputRef.current?.click()}>
          {src ? AS.media.replace : AS.media.upload}
        </Button>
        {src ? (
          <Button small variant="ghost" disabled={pending} onClick={() => void handleRemove()}>
            {AS.media.remove}
          </Button>
        ) : null}
      </div>
      {notice ? <p className={styles.mediaNotice}>{notice}</p> : null}
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
