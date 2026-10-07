import { useEffect, useRef, useState } from 'react'
import { infoPages } from '../../data/content'
import { AS } from '../adminStrings'
import { AdminIcon } from '../ui/AdminIcon'
import { Btn } from '../ui/Button'
import ui from '../ui/ui.module.css'
import styles from '../admin.module.css'

export type PreviewLang = 'tr' | 'en'
export type PreviewDevice = 'desktop' | 'tablet' | 'mobile'

/**
 * Cihaz başına sanal görünüm genişliği (px). Önizleme sütunu dar olduğundan iframe bu genişlikte
 * çizilir ve CSS `transform: scale()` ile sütuna sığdırılır; böylece "Masaüstü" gerçekten masaüstü
 * yerleşimini gösterir (aksi hâlde sütun genişliğinde tablet/mobil yerleşimi çıkıyordu).
 */
const PREVIEW_DEVICE_WIDTH: Record<PreviewDevice, number> = { desktop: 1280, tablet: 820, mobile: 390 }

/** Son odaklanan/düzenlenen alan; `nonce` her istekte artar ki aynı alana yeniden kaydırılabilsin. */
export interface PreviewFocus {
  key: string
  lang: PreviewLang
  nonce: number
}

interface ContentPreviewPaneProps {
  /** Grubun açılış sayfası (`/`, `/#uretim`, `/bilgi/sss`). */
  initialPage: string
  /** Alan anahtarı → görüldüğü sayfa (null: sayfa önizlemesi yok). */
  pageOf: (key: string) => string | null
  /** Alan anahtarı → paneldeki etiket (görünmeyen değişiklikler satırı için). */
  labelOf: (key: string) => string
  /** Grubun TÜM alanlarının taslak değerleri ve taslak ≠ kayıtlı anahtarları, dile göre. */
  draft: Record<PreviewLang, { fields: Record<string, string | null>; changed: string[] }>
  /** Çerez grubu: banner metni düzenlenirken banner görünür olsun. */
  showCookieBanner: boolean
  focus: PreviewFocus | null
  onClose: () => void
}

const PREVIEW_QUERY = 'onizleme=icerik'

/** `page` + dil → iframe adresi. `/#uretim` gibi hash'li sayfalarda sorgu hash'ten önce gelir. */
function previewUrl(page: string, lang: PreviewLang, withQuery: boolean): string {
  const [path, hash] = page.split('#')
  const base = lang === 'en' ? '/en' : ''
  const p = path === '/' ? (lang === 'en' ? '' : '/') : path
  return `${window.location.origin}${base}${p}${withQuery ? `?${PREVIEW_QUERY}` : ''}${hash ? `#${hash}` : ''}`
}

/** Hash ve sorgu dışında aynı yol mu (`/#uretim` ile `/` aynı sayfadır). */
function samePage(a: string, b: string): boolean {
  const bare = (s: string) => s.split(/[?#]/)[0] || '/'
  return bare(a) === bare(b)
}

function pageName(page: string): string {
  if (page === '/') return AS.content.previewPageHome
  if (page.startsWith('/#')) return AS.content.previewPageProduction
  const slug = page.replace(/^\/bilgi\//, '')
  return infoPages.find((p) => p.slug === slug)?.title ?? page
}

const isString = (v: unknown): v is string => typeof v === 'string'

/**
 * Grup kartındaki canlı önizleme: aynı origin'deki mağaza `?onizleme=icerik` ile iframe'e yüklenir,
 * köprü (src/components/layout/ContentPreviewBridge.tsx) hazır olunca taslak alanlar postMessage ile
 * gönderilir (300 ms debounce). Odaklanan alan başka sayfadaysa iframe o sayfaya geçer; EN alanına
 * odaklanınca İngilizce site gösterilir. Kayıt akışına dokunmaz.
 */
export function ContentPreviewPane({ initialPage, pageOf, labelOf, draft, showCookieBanner, focus, onClose }: ContentPreviewPaneProps) {
  const [page, setPage] = useState(initialPage)
  const [lang, setLang] = useState<PreviewLang>('tr')
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [reload, setReload] = useState(0)
  /**
   * Köprü durumu, ait olduğu iframe yüklemesinin anahtarıyla saklanır: iframe yeniden yüklenince
   * (anahtar değişince) ready/yol/eksik bilgisi kendiliğinden sıfırlanmış sayılır.
   */
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const [navState, setNavState] = useState<{ key: string; path: string } | null>(null)
  const [missingState, setMissingState] = useState<{ key: string; missing: string[] } | null>(null)
  /** "Değişen alana git" isteği: anahtar + sayaç. */
  const [goTo, setGoTo] = useState<{ key: string; nonce: number } | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const sentFocusNonce = useRef(-1)
  const sentGoNonce = useRef(-1)

  // Çerçeve kabının gerçek ölçüsü: iframe sanal cihaz genişliğinde çizilip bu ölçüye ölçeklenir.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [wrapSize, setWrapSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setWrapSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const deviceWidth = PREVIEW_DEVICE_WIDTH[device]
  const scale = wrapSize.w > 0 ? Math.min(1, wrapSize.w / deviceWidth) : 1
  const frameStyle = {
    width: deviceWidth,
    height: wrapSize.h > 0 ? Math.round(wrapSize.h / scale) : '100%',
    transform: `scale(${scale})`,
    left: Math.max(0, Math.round((wrapSize.w - deviceWidth * scale) / 2)),
  } as const

  const src = previewUrl(page, lang, true)
  const frameKey = `${src}#${reload}`
  const ready = readyKey === frameKey
  const currentPath = navState?.key === frameKey ? navState.path : null
  const missing = missingState?.key === frameKey ? missingState.missing : []

  // Mesaj dinleyicisi ve odak efekti güncel anahtar/sayfa/yolu ref'ten okur (bağımlılık olmadan).
  const frameKeyRef = useRef(frameKey)
  const pageRef = useRef(page)
  const pathRef = useRef(currentPath)
  useEffect(() => {
    frameKeyRef.current = frameKey
    pageRef.current = page
    pathRef.current = currentPath
  }, [frameKey, page, currentPath])

  // Köprüden gelen iletiler — yalnızca aynı origin ve bu iframe'in penceresi.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return
      const d = e.data as { type?: unknown; path?: unknown; missing?: unknown } | null
      if (!d || typeof d !== 'object') return
      const key = frameKeyRef.current
      if (d.type === 'tsc-preview-ready') setReadyKey(key)
      else if (d.type === 'tsc-preview-applied') setMissingState({ key, missing: Array.isArray(d.missing) ? d.missing.filter(isString) : [] })
      else if (d.type === 'tsc-preview-nav' && typeof d.path === 'string') setNavState({ key, path: d.path })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  /** Hedef sayfa iframe'de gösterilenden farklıysa oraya git (aynı sayfa ama içeride başka yere gidilmişse yeniden yükle). */
  function navigateTo(target: string) {
    const shown = pathRef.current ?? pageRef.current
    if (samePage(target, shown)) return
    if (samePage(target, pageRef.current)) setReload((r) => r + 1)
    else setPage(target)
  }

  // Alan odaklandı: dili eşle, alanın sayfası farklıysa iframe'i o sayfaya götür.
  useEffect(() => {
    if (!focus || focus.nonce === sentFocusNonce.current) return
    setLang(focus.lang)
    const target = pageOf(focus.key)
    if (!target) return
    const shown = pathRef.current ?? pageRef.current
    if (samePage(target, shown)) return
    if (samePage(target, pageRef.current)) setReload((r) => r + 1)
    else setPage(target)
  }, [focus, pageOf])

  const active = draft[lang]

  // Taslak gönderimi: köprü hazırken, her değişiklikte 300 ms debounce ile.
  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(() => {
      const win = iframeRef.current?.contentWindow
      if (!win) return
      let scrollTo: string | undefined
      if (focus && focus.nonce !== sentFocusNonce.current) {
        sentFocusNonce.current = focus.nonce
        scrollTo = focus.key
      }
      if (goTo && goTo.nonce !== sentGoNonce.current) {
        sentGoNonce.current = goTo.nonce
        scrollTo = goTo.key
      }
      win.postMessage({ type: 'tsc-preview-set', fields: active.fields, changed: active.changed, showCookieBanner, scrollTo }, window.location.origin)
    }, 300)
    return () => window.clearTimeout(t)
  }, [ready, active, showCookieBanner, focus, goTo])

  function goToChanged() {
    const key = focus && active.changed.includes(focus.key) ? focus.key : active.changed[0]
    if (!key) return
    const target = pageOf(key)
    if (target) navigateTo(target)
    setGoTo((g) => ({ key, nonce: (g?.nonce ?? 0) + 1 }))
  }

  const missingLabels = missing.map(labelOf).join(', ')
  const shownPath = currentPath && !samePage(currentPath, page) ? currentPath : null

  return (
    <div className={styles.previewPane} aria-label={AS.content.previewTitle}>
      <div className={styles.previewBar}>
        <span className={styles.previewPageName}>
          <span>{pageName(page)}</span>
          {shownPath ? <span className={styles.previewPagePath}>{AS.content.previewPageCurrent(shownPath)}</span> : null}
        </span>
        <span className={ui.segmented} role="group" aria-label={AS.content.previewLangLabel}>
          <button type="button" aria-pressed={lang === 'tr'} onClick={() => setLang('tr')}>
            {AS.content.previewLangTr}
          </button>
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
            {AS.content.previewLangEn}
          </button>
        </span>
        <span className={ui.segmented} role="group" aria-label={AS.content.previewDeviceLabel}>
          <button type="button" aria-pressed={device === 'desktop'} title={`${PREVIEW_DEVICE_WIDTH.desktop} px`} onClick={() => setDevice('desktop')}>
            {AS.content.previewDesktop}
          </button>
          <button type="button" aria-pressed={device === 'tablet'} title={`${PREVIEW_DEVICE_WIDTH.tablet} px`} onClick={() => setDevice('tablet')}>
            {AS.content.previewTablet}
          </button>
          <button type="button" aria-pressed={device === 'mobile'} title={`${PREVIEW_DEVICE_WIDTH.mobile} px`} onClick={() => setDevice('mobile')}>
            {AS.content.previewMobile}
          </button>
        </span>
        <span className={styles.previewScale} aria-live="polite">
          {deviceWidth} px · %{Math.round(scale * 100)}
        </span>
        <Btn size="sm" variant="ghost" onClick={goToChanged} disabled={!ready || active.changed.length === 0}>
          {AS.content.previewGoToChanged}
        </Btn>
        <a className={[ui.btn, ui.btnGhost, ui.btnSm].join(' ')} href={previewUrl(page, lang, false)} target="_blank" rel="noopener noreferrer">
          <AdminIcon name="external" size={16} />
          {AS.content.previewOpenTab}
        </a>
        <Btn size="sm" variant="ghost" icon="close" iconOnly label={AS.content.previewClose} onClick={onClose} />
      </div>
      <div ref={wrapRef} className={styles.previewFrameWrap} data-device={device}>
        <iframe
          key={frameKey}
          ref={iframeRef}
          src={src}
          title={AS.content.previewTitle}
          className={styles.previewFrame}
          style={frameStyle}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
        {!ready ? (
          <div className={styles.previewLoading} role="status" aria-live="polite">
            <span className={ui.spinner} aria-hidden="true" />
            {AS.content.previewLoading}
          </div>
        ) : null}
      </div>
      {missing.length ? (
        <div className={styles.previewMissing} role="status">
          <AdminIcon name="info" size={16} />
          <span>{AS.content.previewMissing(missingLabels)}</span>
        </div>
      ) : null}
    </div>
  )
}
