import type { KeyboardEvent } from 'react'
import { siteSettings } from '../../config/settings'
import type { MediaSlotData } from '../../data/types'
import { S } from '../../i18n'
import { MediaSlot } from '../ui/MediaSlot'
import styles from './Gallery.module.css'

interface GalleryProps {
  media: MediaSlotData[]
  index: number
  onIndexChange: (index: number) => void
  onOpenLightbox: () => void
}

function activateOnKey(e: KeyboardEvent, run: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    run()
  }
}

/** Masaüstü ürün galerisi: solda küçük önizlemeler, sağda büyük görsel; büyük görsel Lightbox açar. */
export function Gallery({ media, index, onIndexChange, onOpenLightbox }: GalleryProps) {
  const active = media[index] ?? media[0]
  if (!active) return null

  return (
    <div className={styles.gallery}>
      <div className={styles.thumbs} aria-label={S.product.thumbnails}>
        {media.map((m, i) => {
          const isActive = i === index
          return (
            <div
              key={m.kind}
              role="button"
              tabIndex={0}
              aria-current={isActive ? 'true' : undefined}
              className={[styles.thumb, isActive ? styles.thumbActive : ''].join(' ').trim()}
              onClick={() => onIndexChange(i)}
              onKeyDown={(e) => activateOnKey(e, () => onIndexChange(i))}
            >
              <MediaSlot label={m.label} src={m.src} ratio={siteSettings.catalog.mediaRatio} captionSize="sm" />
            </div>
          )
        })}
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={S.product.openLarge}
        className={styles.main}
        data-gallery-main
        onClick={onOpenLightbox}
        onKeyDown={(e) => activateOnKey(e, onOpenLightbox)}
      >
        <MediaSlot label={active.label} src={active.src} ratio={siteSettings.catalog.mediaRatio} captionSize="lg" />
      </div>
    </div>
  )
}
