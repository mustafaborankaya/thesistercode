/**
 * Birinci taraf ölçüm istemcisi (bkz. api `POST /events`) ve pazarlama servisleri için sınır.
 *
 * - Yalnızca API modunda (`isApiMode()`) ve `/admin` dışındaki yollarda çalışır; hata asla kullanıcıya yansımaz.
 * - Olaylar herkes için (kimliksiz) sayılır; ziyaretçi/oturum kimlikleri YALNIZCA analitik çerez onayı varsa
 *   eklenir. Onay yoksa ya da tarayıcı "Do Not Track" bildiriyorsa kimlikler null gider ve saklı olanlar silinir.
 * - Olaylar kuyrukta birikir; 2 sn sessizlikten sonra ya da sayfa gizlenince/kapanırken (`keepalive`) gönderilir.
 * - Veri yalnızca kendi sunucumuza gider; IP ve ham tarayıcı kimliği sunucuda saklanmaz.
 */
import { isApiMode } from '../data/remote'
import { locale } from '../i18n'
import { readJSON, removeKey, storageKeys, writeJSON } from '../lib/storage'
import { api } from './api'

export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'search'
  | 'checkout_start'
  | 'order_complete'
  | 'consent'
  | 'favorite_add'

/** `POST /events` gövdesindeki tek olay (sözleşme §2). */
export interface AnalyticsEvent {
  type: AnalyticsEventType
  path?: string
  locale: 'tr' | 'en'
  vid: string | null
  sid: string | null
  entry?: boolean
  ref?: string
  utm?: { source: string; medium: string; campaign: string }
  vw?: number
  productId?: string
  query?: string
  value?: number
  meta?: Record<string, unknown>
}

const FLUSH_DELAY_MS = 2000
const MAX_BATCH = 20
const SESSION_IDLE_MS = 30 * 60 * 1000
/** Ziyaretçi kimliği ~13 aydan eskiyse yenilenir. */
const VISITOR_MAX_AGE_MS = 395 * 24 * 60 * 60 * 1000

/* ---------------- Saf yardımcılar ---------------- */

/** `/en` önekini soyar, sorgu/hash'i atar, 255 karakterle sınırlar. */
export function normalizePath(path: string): string {
  let p = path.split(/[?#]/)[0] || '/'
  if (p === '/en') p = '/'
  else if (p.startsWith('/en/')) p = p.slice(3)
  if (!p.startsWith('/')) p = `/${p}`
  return p.slice(0, 255)
}

/** 32 karakterlik rastgele onaltılık kimlik (kişisel veri içermez). */
export function newId(): string {
  const bytes = new Uint8Array(16)
  try {
    crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const ID_RE = /^[0-9a-f]{32}$/

/** Çerez tercihi → olay `meta.choice`. */
export function consentChoice(prefs: { analytics: boolean; marketing: boolean }): 'all' | 'necessary' | 'custom' {
  if (prefs.analytics && prefs.marketing) return 'all'
  if (!prefs.analytics && !prefs.marketing) return 'necessary'
  return 'custom'
}

const money = (n: number) => Math.round(n * 100) / 100

/* ---------------- Onay ve kimlikler ---------------- */

let analyticsStarted = false
let marketingStarted = false
/** start/stop çağrıldıysa kesin onay durumu; henüz çağrılmadıysa (açılışın ilk anı) saklı tercihe bakılır. */
let analyticsConsent: boolean | null = null

function hasAnalyticsConsent(): boolean {
  if (analyticsConsent !== null) return analyticsConsent
  const stored = readJSON<{ status?: string; analytics?: boolean } | null>(storageKeys.consent, null)
  return stored?.status === 'decided' && stored.analytics === true
}

function doNotTrack(): boolean {
  try {
    return navigator.doNotTrack === '1'
  } catch {
    return false
  }
}

function clearIds(): void {
  removeKey(storageKeys.visitorId)
  removeKey(storageKeys.sessionId, 'session')
}

/** Onay varsa kimlikleri döner (gerekirse oluşturur/yeniler, oturumun son etkinliğini günceller); yoksa siler. */
function resolveIds(now: number): { vid: string | null; sid: string | null } {
  if (!hasAnalyticsConsent() || doNotTrack()) {
    clearIds()
    return { vid: null, sid: null }
  }
  let visitor = readJSON<{ id?: string; createdAt?: number } | null>(storageKeys.visitorId, null)
  if (!visitor?.id || !ID_RE.test(visitor.id) || typeof visitor.createdAt !== 'number' || now - visitor.createdAt > VISITOR_MAX_AGE_MS) {
    visitor = { id: newId(), createdAt: now }
    writeJSON(storageKeys.visitorId, visitor)
  }
  let session = readJSON<{ id?: string; lastActive?: number } | null>(storageKeys.sessionId, null, 'session')
  if (!session?.id || !ID_RE.test(session.id) || typeof session.lastActive !== 'number' || now - session.lastActive > SESSION_IDLE_MS) {
    session = { id: newId(), lastActive: now }
  } else {
    session = { id: session.id, lastActive: now }
  }
  writeJSON(storageKeys.sessionId, session, 'session')
  return { vid: visitor.id ?? null, sid: session.id ?? null }
}

/* ---------------- Kuyruk ---------------- */

let queue: AnalyticsEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let listenersBound = false

function flush(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (queue.length === 0) return
  const pending = queue
  queue = []
  for (let i = 0; i < pending.length; i += MAX_BATCH) {
    const events = pending.slice(i, i + MAX_BATCH)
    // Ölçüm isteği başarısız olursa olaylar sessizce düşer; kullanıcı akışı etkilenmez.
    api('/events', { method: 'POST', body: { events }, keepalive: true }).catch(() => undefined)
  }
}

function bindPageListeners(): void {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

function currentPathAllowed(): boolean {
  try {
    const p = normalizePath(window.location.pathname)
    return p !== '/admin' && !p.startsWith('/admin/')
  } catch {
    return false
  }
}

/** Kimlikler olay ANINDAKİ onay durumuna göre eklenir (onaydan önceki olaylar sonradan kimlik almaz). */
function enqueue(event: Omit<AnalyticsEvent, 'locale' | 'vw' | 'vid' | 'sid'>): void {
  try {
    if (!isApiMode() || !currentPathAllowed()) return
    bindPageListeners()
    queue.push({ ...event, locale, vw: Math.max(0, Math.min(65535, Math.round(window.innerWidth))), ...resolveIds(Date.now()) })
    if (queue.length >= MAX_BATCH) {
      flush()
      return
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, FLUSH_DELAY_MS)
  } catch {
    /* ölçüm asla uygulamayı bozmaz */
  }
}

/* ---------------- Giriş (ilk sayfa) bilgisi ---------------- */

/** Tam sayfa yüklemesi anındaki URL'den UTM parametreleri (sonraki SPA gezinmeleri etkilemez). */
const loadUtm = (() => {
  try {
    const q = new URLSearchParams(window.location.search)
    return {
      source: (q.get('utm_source') ?? '').slice(0, 80),
      medium: (q.get('utm_medium') ?? '').slice(0, 80),
      campaign: (q.get('utm_campaign') ?? '').slice(0, 120),
    }
  } catch {
    return { source: '', medium: '', campaign: '' }
  }
})()

/** Tam sayfa yüklemesinden sonraki ilk page_view gönderildi mi. */
let entrySent = false

/* ---------------- Dışa açık izleme noktaları ---------------- */

export function trackPageView(path: string): void {
  const normalized = normalizePath(path)
  if (normalized === '/admin' || normalized.startsWith('/admin/')) return
  if (!isApiMode()) return
  if (!entrySent) {
    entrySent = true
    let ref = ''
    try {
      ref = document.referrer.slice(0, 500)
    } catch {
      /* yoksay */
    }
    enqueue({ type: 'page_view', path: normalized, entry: true, ref, utm: loadUtm })
    return
  }
  enqueue({ type: 'page_view', path: normalized })
}

export function trackProductView(productId: string): void {
  enqueue({ type: 'product_view', path: normalizePath(window.location.pathname), productId })
}

export function trackAddToCart(input: { productId: string; colorId: string; size: string; qty: number; unitPrice: number }): void {
  enqueue({
    type: 'add_to_cart',
    path: normalizePath(window.location.pathname),
    productId: input.productId,
    value: money(input.unitPrice * input.qty),
    meta: { colorId: input.colorId, size: input.size, qty: input.qty },
  })
}

export function trackSearch(query: string, results: number): void {
  const q = query.trim().slice(0, 120)
  if (!q) return
  enqueue({ type: 'search', path: normalizePath(window.location.pathname), query: q, meta: { results } })
}

export function trackCheckoutStart(total: number, items: number): void {
  enqueue({ type: 'checkout_start', path: normalizePath(window.location.pathname), value: money(total), meta: { items } })
}

export function trackOrderComplete(orderId: string, total: number): void {
  enqueue({ type: 'order_complete', path: normalizePath(window.location.pathname), value: money(total), meta: { orderId } })
}

export function trackConsent(prefs: { analytics: boolean; marketing: boolean }): void {
  // Karar olayı yeni tercihe göre kimlik taşır (kabulde kimlikli, retde kimliksiz).
  analyticsConsent = prefs.analytics
  enqueue({
    type: 'consent',
    path: normalizePath(window.location.pathname),
    meta: { analytics: prefs.analytics, marketing: prefs.marketing, choice: consentChoice(prefs) },
  })
}

export function trackFavoriteAdd(productId: string): void {
  enqueue({ type: 'favorite_add', path: normalizePath(window.location.pathname), productId })
}

/* ---------------- Onay sınırı (ConsentContext) ---------------- */

/** Analitik çerez onayı verildi: sonraki gönderimlerde ziyaretçi/oturum kimlikleri eklenir. */
export function startAnalytics(): void {
  analyticsConsent = true
  if (analyticsStarted) return
  analyticsStarted = true
}

/** Analitik onayı geri alındı/verilmedi: kimlikler silinir; olaylar yalnızca kimliksiz sayılır. */
export function stopAnalytics(): void {
  analyticsConsent = false
  analyticsStarted = false
  clearIds()
  // Henüz gönderilmemiş olaylardaki kimlikler de düşürülür.
  queue = queue.map((e) => ({ ...e, vid: null, sid: null }))
}

export function startMarketing(): void {
  if (marketingStarted) return
  marketingStarted = true
  // Gerçek pazarlama servisi burada başlatılacak.
}
