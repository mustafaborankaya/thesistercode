import type { CSSProperties, ReactNode } from 'react'
import styles from './MediaSlot.module.css'

interface MediaSlotProps {
  /** Alana gelecek içeriğin adı; görsel yokken küçük siyah açıklama olarak gösterilir. */
  label: string
  /** CSS aspect-ratio değeri; ürün görselleri için 3 / 4. */
  ratio?: string
  /** Gerçek görsel/video geldiğinde kaynağı; yerleşim değişmeden içeriği kaplar. */
  src?: string | null
  kind?: 'image' | 'video'
  captionSize?: 'sm' | 'md' | 'lg'
  className?: string
  style?: CSSProperties
  /** Alanın üzerine binen içerik (oynat simgesi, rozet vb.). */
  children?: ReactNode
  /** Gerçek görsel için alternatif metin; boşken etiket kullanılır. */
  alt?: string
}

export function MediaSlot({ label, ratio = '3 / 4', src, kind = 'image', captionSize = 'md', className, style, children, alt }: MediaSlotProps) {
  const captionClass = [styles.caption, captionSize === 'lg' ? styles.captionLg : '', captionSize === 'sm' ? styles.captionSm : ''].join(' ').trim()
  return (
    <div className={[styles.slot, className ?? ''].join(' ').trim()} style={{ aspectRatio: ratio, ...style }} data-media-slot={label}>
      {src ? (
        kind === 'video' ? (
          <video src={src} playsInline preload="metadata" aria-label={alt ?? label} />
        ) : (
          <img src={src} alt={alt ?? label} loading="lazy" decoding="async" />
        )
      ) : (
        <span className={captionClass}>{label}</span>
      )}
      {children ? <div className={styles.overlay}>{children}</div> : null}
    </div>
  )
}
