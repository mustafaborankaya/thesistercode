import { useEffect } from 'react'
import type { MediaSlotData } from '../../data/types'
import { S } from '../../i18n'
import { usePanels } from '../../state/PanelContext'
import { IconButton } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { MediaSlot } from '../ui/MediaSlot'
import styles from './Lightbox.module.css'

interface LightboxProps {
  media: MediaSlotData[]
  index: number
  onIndexChange: (index: number) => void
}

/** Büyük görünüm — merkezde açılan Drawer; ok tuşları ve önceki/sonraki kontrolleriyle gezinir. */
export function Lightbox({ media, index, onIndexChange }: LightboxProps) {
  const { isOpen, closePanel } = usePanels()
  const open = isOpen('lightbox')
  const count = media.length
  const active = media[index] ?? media[0]

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count)
      else if (e.key === 'ArrowRight') onIndexChange((index + 1) % count)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, index, count, onIndexChange])

  if (!active) return null

  return (
    <Drawer open={open} onClose={() => closePanel('lightbox')} title={S.product.gallery} side="center" hideTitle className={styles.drawer}>
      <div className={styles.stage}>
        <MediaSlot label={active.label} src={active.src} ratio="3 / 4" style={{ height: 'min(80dvh, 700px)', width: 'auto', margin: '0 auto' }} />
      </div>
      {count > 1 ? (
        <div className={styles.controls}>
          <IconButton icon="chevron-left" label={S.product.prev} onClick={() => onIndexChange((index - 1 + count) % count)} />
          <span className={styles.counter}>{S.product.galleryPosition(index + 1, count)}</span>
          <IconButton icon="chevron-right" label={S.product.next} onClick={() => onIndexChange((index + 1) % count)} />
        </div>
      ) : null}
    </Drawer>
  )
}
