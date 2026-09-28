import { useId, useRef, useState, type DragEvent } from 'react'
import { AS } from '../adminStrings'
import { AdminIcon } from './AdminIcon'
import { Btn } from './Button'
import { IMAGE_TYPES, VIDEO_TYPES, validateUpload } from './upload'
import s from './ui.module.css'

interface ImageSlotProps {
  label: string
  src: string | null
  ratio?: string
  kind?: 'image' | 'video'
  /** Önerilen ölçü vb. kısa bilgi. */
  meta?: string
  pending?: boolean
  error?: string | null
  onFile: (file: File) => void
  /** Verilmezse Kaldır düğmesi gösterilmez. */
  onRemove?: () => void
}

/**
 * Görsel yuvası: önizleme + sürükle-bırak / tıkla-yükle + Değiştir + Kaldır. Dosya türü ve boyutu
 * seçilir seçilmez istemcide denetlenir (sunucuya gitmeden uyarı).
 */
export function ImageSlot({ label, src, ratio = '3 / 4', kind = 'image', meta, pending, error, onFile, onRemove }: ImageSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const id = useId()
  const accept = kind === 'video' ? VIDEO_TYPES.join(',') : IMAGE_TYPES.join(',')

  function take(file: File | undefined) {
    if (!file) return
    const problem = validateUpload(file, kind)
    setLocalError(problem)
    if (!problem) onFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (pending) return
    take(e.dataTransfer.files?.[0])
  }

  const shownError = localError ?? error
  return (
    <div className={s.slot}>
      <div className={s.slotHead}>
        <span className={s.slotLabel} id={`${id}-l`}>
          {label}
        </span>
        {meta ? <span className={s.slotMeta}>{meta}</span> : null}
      </div>
      <button
        type="button"
        className={[s.slotDrop, src ? s.slotFilled : '', dragging ? s.slotDragging : ''].join(' ')}
        style={{ aspectRatio: ratio }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!dragging) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={pending}
        aria-describedby={shownError ? `${id}-e` : undefined}
        aria-label={src ? AS.media.replaceAria(label) : AS.media.uploadAria(label)}
      >
        {src ? (
          kind === 'video' ? (
            <video src={src} muted playsInline preload="metadata" />
          ) : (
            <img src={src} alt="" loading="lazy" />
          )
        ) : (
          <span className={s.slotEmpty}>
            <AdminIcon name="upload" size={22} />
            <span>{AS.media.dropHint}</span>
          </span>
        )}
        {pending ? (
          <span className={s.slotBusy}>
            <span className={s.spinner} />
          </span>
        ) : null}
      </button>
      <div className={s.slotActions}>
        <Btn size="sm" icon="upload" onClick={() => inputRef.current?.click()} disabled={pending}>
          {src ? AS.media.replace : AS.media.upload}
        </Btn>
        {src && onRemove ? (
          <Btn size="sm" variant="ghost" icon="trash" onClick={onRemove} disabled={pending}>
            {AS.media.remove}
          </Btn>
        ) : null}
      </div>
      {shownError ? (
        <p id={`${id}-e`} className={s.error} role="alert">
          <AdminIcon name="alert" size={14} />
          <span>{shownError}</span>
        </p>
      ) : null}
      <input ref={inputRef} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-labelledby={`${id}-l`} onChange={(e) => take(e.target.files?.[0])} />
    </div>
  )
}
