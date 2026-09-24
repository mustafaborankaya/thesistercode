import { useEffect, useRef, useState } from 'react'
import { siteSettings } from '../../config/settings'
import type { MediaSlotData } from '../../data/types'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { S } from '../../i18n'
import { MediaSlot } from '../ui/MediaSlot'
import styles from './MobileGallery.module.css'

interface MobileGalleryProps {
  media: MediaSlotData[]
}

/** Parmakla kaydırılabilir mobil galeri; nokta + sayaç ile konum bildirimi. */
export function MobileGallery({ media }: MobileGalleryProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const reducedMotion = useReducedMotion()
  const ticking = useRef(false)

  useEffect(() => {
    setIndex(0)
    trackRef.current?.scrollTo({ left: 0 })
  }, [media])

  const onScroll = () => {
    if (ticking.current) return
    ticking.current = true
    requestAnimationFrame(() => {
      const el = trackRef.current
      if (el && el.clientWidth > 0) {
        const i = Math.round(el.scrollLeft / el.clientWidth)
        setIndex(Math.min(media.length - 1, Math.max(0, i)))
      }
      ticking.current = false
    })
  }

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  if (media.length === 0) return null

  return (
    <div className={styles.wrap}>
      <div ref={trackRef} className={styles.track} onScroll={onScroll} aria-label={S.product.gallery} data-mobile-gallery-track>
        {media.map((m) => (
          <div key={m.kind} className={styles.slide}>
            <MediaSlot label={m.label} src={m.src} ratio={siteSettings.catalog.mediaRatio} />
          </div>
        ))}
      </div>
      {media.length > 1 ? (
        <div className={styles.status}>
          <div className={styles.dots} aria-hidden="true">
            {media.map((m, i) => (
              <button
                key={m.kind}
                type="button"
                tabIndex={-1}
                className={[styles.dot, i === index ? styles.dotActive : ''].join(' ').trim()}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <span className={styles.counter} aria-live="polite">
            {S.product.galleryPosition(index + 1, media.length)}
          </span>
        </div>
      ) : null}
    </div>
  )
}
