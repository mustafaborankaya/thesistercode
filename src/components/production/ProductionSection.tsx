import { useEffect, useRef, useState } from 'react'
import { productionContent } from '../../data/content'
import { S } from '../../i18n'
import { ContentText } from '../ui/ContentText'
import { IconButton } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { MediaSlot } from '../ui/MediaSlot'
import styles from './ProductionSection.module.css'

/**
 * Ana sayfanın sonunda, bilgilendirme/footer'dan hemen önce yer alan üretim bölümü.
 * Header'daki "Üretim" bağlantısı `/#uretim` ile buraya gelir (id="uretim" bu yüzden zorunlu).
 */
export function ProductionSection() {
  const hasVideo = productionContent.video.value != null
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [showPendingNote, setShowPendingNote] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!started) return
    videoRef.current?.play()
    setPlaying(true)
  }, [started])

  function handlePlaceholderPlay() {
    if (hasVideo) {
      setStarted(true)
      return
    }
    setShowPendingNote(true)
  }

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  function toggleMute() {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  return (
    <section id="uretim" tabIndex={-1} className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{S.production.title}</h2>
        <ContentText field={productionContent.intro} as="p" className={styles.intro} />
      </div>

      <div className={styles.videoBlock}>
        <div className={styles.videoWrap}>
          {hasVideo && started ? (
            <video
              ref={videoRef}
              src={productionContent.video.value ?? undefined}
              muted={muted}
              preload="none"
              playsInline
              className={styles.video}
            />
          ) : (
            <MediaSlot label={productionContent.video.label} ratio="16 / 9" src={productionContent.videoPoster}>
              <button type="button" className={styles.playButton} onClick={handlePlaceholderPlay} aria-label={S.production.play}>
                <Icon name="play" size={26} />
              </button>
            </MediaSlot>
          )}
        </div>

        {hasVideo && started ? (
          <div className={styles.videoControls}>
            <IconButton
              icon={playing ? 'pause' : 'play'}
              label={playing ? S.production.pause : S.production.play}
              onClick={togglePlay}
            />
            <IconButton
              icon={muted ? 'volume-off' : 'volume'}
              label={muted ? S.production.unmute : S.production.mute}
              onClick={toggleMute}
            />
          </div>
        ) : null}

        {!hasVideo && showPendingNote ? (
          <p className={styles.pendingNote} role="status" aria-live="polite">
            {S.production.videoPending}
          </p>
        ) : null}
      </div>

      <ol className={styles.steps} aria-label={S.production.steps}>
        {productionContent.steps.map((step) => (
          <li key={step.id} className={styles.step}>
            <MediaSlot label={step.media} src={step.src} ratio="4 / 5" className={styles.stepMedia} />
            <h3 className={styles.stepTitle}>
              <ContentText field={step.title} as="span" short />
            </h3>
            <ContentText field={step.text} as="p" className={styles.stepText} />
          </li>
        ))}
      </ol>
    </section>
  )
}
