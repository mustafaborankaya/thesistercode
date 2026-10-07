/**
 * Birinci taraf analitik: olay doğrulama/normalizasyon (POST /events) ve yönetici özet raporu
 * (GET /admin/analytics). Bağımlılıksız, küçük UA ayrıştırıcı; ham UA ve IP ASLA saklanmaz.
 *
 * Zaman dilimi: gün/saat/hafta günü kovaları İstanbul (sabit UTC+3) takvimine göredir. `ts` ve
 * `created_at` TIMESTAMP sütunlarıdır; `UNIX_TIMESTAMP(sütun)` oturum saat diliminden BAĞIMSIZ gerçek
 * epoch değerini verdiğinden kovalar `FLOOR((UNIX_TIMESTAMP(ts) + 10800) / 86400)` (gün numarası),
 * `% 86400 / 3600` (saat) ile hesaplanır — `DATE(FROM_UNIXTIME(... + 10800))` ile aynı sonucu verir
 * ama DB oturumu UTC değilken de doğru kalır. Aralık sınırları JS'te istanbulDayStartEpoch ile
 * epoch saniyesi olarak üretilip `ts >= FROM_UNIXTIME(?) AND ts < FROM_UNIXTIME(?)` ile karşılaştırılır.
 */
import { z } from 'zod'
import { pool } from '../db.js'
import { corsOrigins, siteUrl } from '../env.js'
import { badRequest, zodMessage } from '../errors.js'
import { getSetting } from './settings.js'
import { istanbulDayStartEpoch, istanbulToday } from './orders.js'

export const EVENT_TYPES = ['page_view', 'product_view', 'add_to_cart', 'search', 'checkout_start', 'order_complete', 'consent', 'favorite_add']
export const ANALYTICS_RANGES = ['7d', '30d', '90d', '12m']
/** Aralık → gün sayısı (bugün dahil). 12m = son 365 gün. */
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }

/** kpis.orders/revenue ve ürün satışları için sayılan sipariş durumları (demo/iptal/ödeme bekleyen hariç). */
const REVENUE_STATUSES = ['new', 'paid', 'shipped']
const REVENUE_STATUS_SQL = REVENUE_STATUSES.map((s) => `'${s}'`).join(', ')
/** sales.byStatus: demo hariç tüm durumlar, sabit sırada. */
const SALES_STATUSES = ['new', 'pending_payment', 'paid', 'shipped', 'cancelled']

export const DEFAULT_RETENTION_DAYS = 400
export const MIN_RETENTION_DAYS = 30
const MAX_BATCH = 20
const META_MAX_BYTES = 1024

const ID_RE = /^[a-f0-9]{32}$/
/** Yol: '/' ile başlar, sorgu dizesi / hash / boşluk içermez. */
const PATH_RE = /^\/[^?#\s]*$/
export const BOT_RE = /bot|crawler|spider|headless|lighthouse|curl|wget|python-requests/i

const DEVICE_LABELS = { desktop: 'Masaüstü', mobile: 'Mobil', tablet: 'Tablet', other: 'Diğer' }
const LOCALE_LABELS = { tr: 'Türkçe', en: 'English' }
const OTHER_LABEL = 'Diğer'
const SEC_PER_DAY = 86400
const IST_OFFSET_SEC = 10800

/* ---------------- User-Agent ---------------- */

/** Bot/otomasyon UA'ları (boş UA bot sayılmaz; cihaz sınıfı vw'den türetilir). */
export function isBotUserAgent(ua) {
  return typeof ua === 'string' && BOT_RE.test(ua)
}

/**
 * Saf, küçük UA ayrıştırıcı. Yalnızca sınıflandırma için (saklanan tek şey sonuçtur).
 * iPad / Android tablet → 'tablet'; UA belirsizse `vw` (window.innerWidth) yedek: <768 mobile, <1024 tablet,
 * aksi desktop; vw de yoksa 'other'.
 */
export function parseUserAgent(ua, vw = null) {
  const s = typeof ua === 'string' ? ua : ''
  const isBot = isBotUserAgent(s)

  let device = null
  if (/iPad/i.test(s) || /Tablet|Kindle|Silk|PlayBook/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) device = 'tablet'
  else if (/iPhone|iPod|Android|Mobile|Windows Phone|BlackBerry|BB10|Opera Mini|IEMobile/i.test(s)) device = 'mobile'
  else if (/Windows NT|Macintosh|Mac OS X|CrOS|X11|Linux/i.test(s)) device = 'desktop'
  if (!device) {
    const width = Number.isFinite(vw) ? vw : null
    device = width == null ? 'other' : width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
  }

  let browser = null
  if (/Edg(?:e|A|iOS)?\//i.test(s)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(s)) browser = 'Opera'
  else if (/SamsungBrowser/i.test(s)) browser = 'Samsung Internet'
  else if (/YaBrowser/i.test(s)) browser = 'Yandex'
  else if (/Firefox\/|FxiOS/i.test(s)) browser = 'Firefox'
  else if (/CriOS|Chrome\/|Chromium\//i.test(s)) browser = 'Chrome'
  else if (/Safari\//i.test(s) && /Version\//i.test(s)) browser = 'Safari'
  else if (/MSIE|Trident\//i.test(s)) browser = 'IE'

  let os = null
  if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS'
  else if (/Android/i.test(s)) os = 'Android'
  else if (/Windows/i.test(s)) os = 'Windows'
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS'
  else if (/CrOS/i.test(s)) os = 'ChromeOS'
  else if (/Linux|X11/i.test(s)) os = 'Linux'

  return { device, browser, os, isBot }
}

/* ---------------- Olay normalizasyonu ---------------- */

/** CORS_ORIGIN + SITE_URL host'ları (www. öneki atılmış) — bu host'lardan gelen referrer "doğrudan" sayılır. */
function ownHostsFromEnv() {
  const hosts = new Set()
  for (const origin of [...corsOrigins, siteUrl]) {
    try {
      hosts.add(stripWww(new URL(origin).hostname))
    } catch {
      // geçersiz origin — atla
    }
  }
  return [...hosts]
}

function stripWww(host) {
  return String(host).toLowerCase().replace(/^www\./, '')
}

let ownHostsCache = null

/** ref URL'sinden referrer host'u; geçersiz/boş ya da kendi host'umuz → null. */
export function referrerHost(ref, ownHosts = null) {
  if (typeof ref !== 'string' || !ref.trim()) return null
  let host
  try {
    host = stripWww(new URL(ref.trim()).hostname)
  } catch {
    return null
  }
  if (!host) return null
  const own = ownHosts ?? (ownHostsCache ??= ownHostsFromEnv())
  if (own.includes(host)) return null
  return host.slice(0, 120)
}

// Kırpılarak saklanan serbest metinler (utm, arama) için üst sınır; asıl sınırlar trimOrNull'da (80/80/120).
const FREE_TEXT_MAX = 2048
const optionalText = (max) => z.string().max(max).nullable().optional()
const idSchema = z.string().regex(ID_RE, 'Geçersiz kimlik biçimi').nullable().optional()

const eventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  path: z.string().max(255).regex(PATH_RE, "Yol '/' ile başlamalı; sorgu/hash içeremez").nullable().optional(),
  locale: z.enum(['tr', 'en']).nullable().optional(),
  vid: idSchema,
  sid: idSchema,
  entry: z.boolean().nullable().optional(),
  ref: optionalText(FREE_TEXT_MAX),
  utm: z
    .object({ source: optionalText(FREE_TEXT_MAX), medium: optionalText(FREE_TEXT_MAX), campaign: optionalText(FREE_TEXT_MAX) })
    .nullable()
    .optional(),
  vw: z.number().finite().nullable().optional(),
  productId: z.string().max(64).nullable().optional(),
  query: optionalText(FREE_TEXT_MAX),
  value: z.number().min(0).max(9_999_999).nullable().optional(),
  meta: z
    .custom((v) => v === null || v === undefined || (typeof v === 'object' && !Array.isArray(v)), 'Düz bir nesne olmalı')
    .optional(),
})

const batchSchema = z.object({
  events: z.array(z.unknown()).max(MAX_BATCH, `Tek istekte en fazla ${MAX_BATCH} olay gönderilebilir`),
})

/** Kırpılmış metin ya da null (boş → null). */
function trimOrNull(v, max) {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/**
 * Ham istemci olayını doğrular ve DB satırına çevirir. Geçersiz olay → 400 (validation_error).
 * @param {object} raw istemci olayı
 * @param {{ ua?: string, isMember?: boolean, ownHosts?: string[]|null }} ctx
 */
export function normalizeEvent(raw, ctx = {}) {
  const parsed = eventSchema.safeParse(raw)
  if (!parsed.success) throw badRequest(zodMessage(parsed.error), 'validation_error')
  const e = parsed.data

  let meta = null
  if (e.meta != null) {
    meta = JSON.stringify(e.meta)
    if (Buffer.byteLength(meta, 'utf8') > META_MAX_BYTES) throw badRequest('meta en fazla 1 KB olabilir', 'validation_error')
  }

  const vw = e.vw == null ? null : Math.min(65535, Math.max(0, Math.round(e.vw)))
  const { device, browser, os } = parseUserAgent(ctx.ua ?? '', vw)
  const isPageView = e.type === 'page_view'

  return {
    type: e.type,
    visitor_id: e.vid ?? null,
    session_id: e.sid ?? null,
    is_entry: isPageView && e.entry === true ? 1 : 0,
    is_member: ctx.isMember ? 1 : 0,
    path: e.path ?? null,
    locale: e.locale ?? null,
    referrer_host: referrerHost(e.ref, ctx.ownHosts ?? null),
    utm_source: trimOrNull(e.utm?.source, 80),
    utm_medium: trimOrNull(e.utm?.medium, 80),
    utm_campaign: trimOrNull(e.utm?.campaign, 120),
    device,
    browser,
    os,
    vw,
    product_id: trimOrNull(e.productId, 64),
    query: trimOrNull(e.query, 120),
    value: e.value == null ? null : Math.round(e.value * 100) / 100,
    meta,
  }
}

/** `{ events: [...] }` gövdesini doğrular (≤20) ve her olayı normalize eder. */
export function normalizeBatch(body, ctx = {}) {
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) throw badRequest(zodMessage(parsed.error), 'validation_error')
  return parsed.data.events.map((raw) => normalizeEvent(raw, ctx))
}

const INSERT_COLUMNS = [
  'type', 'visitor_id', 'session_id', 'is_entry', 'is_member', 'path', 'locale', 'referrer_host',
  'utm_source', 'utm_medium', 'utm_campaign', 'device', 'browser', 'os', 'vw', 'product_id', 'query', 'value', 'meta',
]

/** Tek bir çok satırlı INSERT. */
export async function insertEvents(rows) {
  if (!rows.length) return 0
  const values = rows.map((r) => INSERT_COLUMNS.map((c) => r[c] ?? null))
  const [result] = await pool.query(`INSERT INTO analytics_events (${INSERT_COLUMNS.join(', ')}) VALUES ?`, [values])
  return result.affectedRows
}

/* ---------------- Saklama süresi ---------------- */

/** `analytics.retentionDays` ayarı; yoksa/geçersizse 400, 30'dan küçükse 30. */
export async function getRetentionDays() {
  const v = await getSetting('analytics.retentionDays')
  if (!Number.isInteger(v)) return DEFAULT_RETENTION_DAYS
  return Math.max(MIN_RETENTION_DAYS, v)
}

const PRUNE_EVERY = 200
let pruneCounter = 0

/** Her ~200 çağrıda bir saklama süresini aşan satırları siler (en fazla 5000; yanıtı bekletmez). */
export function maybePrune() {
  pruneCounter += 1
  if (pruneCounter % PRUNE_EVERY !== 0) return null
  return pruneOldEvents().catch((err) => {
    console.error('[analytics] eski olaylar silinemedi:', err?.message || err)
    return 0
  })
}

export async function pruneOldEvents() {
  const days = await getRetentionDays()
  const [result] = await pool.query('DELETE FROM analytics_events WHERE ts < NOW() - INTERVAL ? DAY LIMIT 5000', [days])
  return result.affectedRows
}

/* ---------------- Özet rapor ---------------- */

const money = (v) => Math.round(Number(v ?? 0) * 100) / 100
const pct = (v) => Math.round(Number(v ?? 0) * 100) / 100
const num = (v) => Number(v ?? 0)

/** Epoch gün numarası (İstanbul takvimi) → 'YYYY-MM-DD'. */
function dayLabel(dayNumber) {
  return new Date(dayNumber * SEC_PER_DAY * 1000).toISOString().slice(0, 10)
}

/** İstanbul takvimine göre 'YYYY-MM-DD' (y, m, d + offset). */
function dateLabel(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
}

// İstanbul (UTC+3) gün numarası / saat / hafta günü (0=Pzt) — oturum saat diliminden bağımsız.
const DAY_OF = (col) => `FLOOR((UNIX_TIMESTAMP(${col}) + ${IST_OFFSET_SEC}) / ${SEC_PER_DAY})`
const HOUR_OF = (col) => `FLOOR(((UNIX_TIMESTAMP(${col}) + ${IST_OFFSET_SEC}) % ${SEC_PER_DAY}) / 3600)`
// 1970-01-01 Perşembe → WEEKDAY (0=Pzt) = 3
const WEEKDAY_OF = (col) => `((${DAY_OF(col)} + 3) % 7)`
const IN_RANGE = (col) => `${col} >= FROM_UNIXTIME(?) AND ${col} < FROM_UNIXTIME(?)`

/** Metin → paylaşım anahtarı ('Samsung Internet' → 'samsung-internet'). */
function shareKey(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Sayıma göre sıralı satırlardan ilk N + 'Diğer' (NULL etiketler de 'Diğer'e girer). */
function topShares(rows, labelCol, top = 6) {
  const named = rows.filter((r) => r[labelCol] != null && String(r[labelCol]).trim()).sort((a, b) => num(b.count) - num(a.count))
  const out = named.slice(0, top).map((r) => ({ key: shareKey(r[labelCol]), label: String(r[labelCol]), count: num(r.count) }))
  const rest = named.slice(top).reduce((s, r) => s + num(r.count), 0) + rows.filter((r) => r[labelCol] == null || !String(r[labelCol]).trim()).reduce((s, r) => s + num(r.count), 0)
  if (rest > 0) out.push({ key: 'other', label: OTHER_LABEL, count: rest })
  return out
}

/** tr/en her zaman (0 olsa da), NULL/diğer değerler 'Diğer'. */
function localeShares(rows) {
  const counts = { tr: 0, en: 0, other: 0 }
  for (const r of rows) {
    const k = r.locale === 'tr' || r.locale === 'en' ? r.locale : 'other'
    counts[k] += num(r.count)
  }
  const out = [
    { key: 'tr', label: LOCALE_LABELS.tr, count: counts.tr },
    { key: 'en', label: LOCALE_LABELS.en, count: counts.en },
  ]
  if (counts.other > 0) out.push({ key: 'other', label: OTHER_LABEL, count: counts.other })
  return out
}

/**
 * GET /admin/analytics yanıtı — şekil ortak sözleşmedeki AnalyticsOverview ile birebir.
 * Aralık: 7d/30d/90d bugün dahil son N gün; 12m bugün dahil son 365 gün. previous: aynı uzunluktaki
 * hemen önceki dönem; o dönemde hiç izleme (ilk olay daha sonra) / hiç sipariş geçmişi yoksa null.
 */
export async function getOverview({ range = '30d' } = {}) {
  if (!RANGE_DAYS[range]) throw badRequest('Geçersiz aralık; izin verilenler: 7d, 30d, 90d, 12m', 'validation_error')
  const days = RANGE_DAYS[range]
  const { y, m, d } = istanbulToday()
  const start = istanbulDayStartEpoch(y, m, d - (days - 1))
  const end = istanbulDayStartEpoch(y, m, d + 1)
  const prevStart = istanbulDayStartEpoch(y, m, d - (2 * days - 1))
  const from = dateLabel(y, m, d - (days - 1))
  const to = dateLabel(y, m, d)
  const cur = [start, end]
  const both = [prevStart, end]
  const q = (sql, params) => pool.query(sql, params).then(([rows]) => rows)

  /* ---- izleme durumu ---- */
  const [[trackingRow], [eventsRow], retentionDays, [firstOrderRow]] = await Promise.all([
    q('SELECT UNIX_TIMESTAMP(MIN(ts)) AS since FROM analytics_events'),
    q(`SELECT COUNT(*) AS n FROM analytics_events WHERE ${IN_RANGE('ts')}`, cur),
    getRetentionDays(),
    q("SELECT UNIX_TIMESTAMP(MIN(created_at)) AS since FROM orders WHERE status <> 'demo'"),
  ])
  const sinceEpoch = trackingRow?.since == null ? null : Number(trackingRow.since)
  const hasPrevEvents = sinceEpoch != null && sinceEpoch < start
  const firstOrderEpoch = firstOrderRow?.since == null ? null : Number(firstOrderRow.since)
  const hasPrevOrders = firstOrderEpoch != null && firstOrderEpoch < start

  /* ---- KPI'lar: mevcut + önceki dönem tek sorguda (cur = 1 mevcut dönem) ---- */
  const eventKpiRows = await q(
    `SELECT (ts >= FROM_UNIXTIME(?)) AS cur,
            SUM(type = 'page_view') AS pageviews,
            SUM(type = 'page_view' AND is_entry = 1) AS visits,
            COUNT(DISTINCT visitor_id) AS visitors,
            COUNT(DISTINCT session_id) AS sessions,
            SUM(type = 'page_view' AND visitor_id IS NOT NULL) AS consented
       FROM analytics_events WHERE ${IN_RANGE('ts')} GROUP BY cur`,
    [start, ...both],
  )
  const orderKpiRows = await q(
    `SELECT (created_at >= FROM_UNIXTIME(?)) AS cur, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
       FROM orders WHERE status IN (${REVENUE_STATUS_SQL}) AND ${IN_RANGE('created_at')} GROUP BY cur`,
    [start, ...both],
  )
  const pick = (rows, isCur) => rows.find((r) => Number(r.cur) === (isCur ? 1 : 0)) ?? {}
  const ev = pick(eventKpiRows, true)
  const evPrev = pick(eventKpiRows, false)
  const od = pick(orderKpiRows, true)
  const odPrev = pick(orderKpiRows, false)

  const pageviews = num(ev.pageviews)
  const visits = num(ev.visits)
  const orders = num(od.orders)
  const revenue = money(od.revenue)
  const prevVisits = num(evPrev.visits)
  const prevOrders = num(odPrev.orders)
  const prevRevenue = money(odPrev.revenue)
  const conversion = (o, v) => (v > 0 ? pct((o / v) * 100) : 0)
  const aov = (r, o) => (o > 0 ? money(r / o) : 0)
  const evDelta = (value, previous) => ({ value, previous: hasPrevEvents ? previous : null })
  const odDelta = (value, previous) => ({ value, previous: hasPrevOrders ? previous : null })

  const kpis = {
    pageviews: evDelta(pageviews, num(evPrev.pageviews)),
    visits: evDelta(visits, prevVisits),
    visitors: evDelta(num(ev.visitors), num(evPrev.visitors)),
    sessions: evDelta(num(ev.sessions), num(evPrev.sessions)),
    orders: odDelta(orders, prevOrders),
    revenue: odDelta(revenue, prevRevenue),
    conversion: { value: conversion(orders, visits), previous: hasPrevEvents && hasPrevOrders ? conversion(prevOrders, prevVisits) : null },
    aov: odDelta(aov(revenue, orders), aov(prevRevenue, prevOrders)),
  }

  /* ---- günlük seri (boş günler 0) ---- */
  const [daySeriesEvents, daySeriesOrders] = await Promise.all([
    q(
      `SELECT ${DAY_OF('ts')} AS day, SUM(type = 'page_view') AS pageviews, SUM(type = 'page_view' AND is_entry = 1) AS visits,
              COUNT(DISTINCT visitor_id) AS visitors
         FROM analytics_events WHERE ${IN_RANGE('ts')} GROUP BY day`,
      cur,
    ),
    q(
      `SELECT ${DAY_OF('created_at')} AS day, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
         FROM orders WHERE status IN (${REVENUE_STATUS_SQL}) AND ${IN_RANGE('created_at')} GROUP BY day`,
      cur,
    ),
  ])
  const byDay = new Map()
  for (const r of daySeriesEvents) byDay.set(dayLabel(num(r.day)), { pageviews: num(r.pageviews), visits: num(r.visits), visitors: num(r.visitors) })
  const ordersByDay = new Map(daySeriesOrders.map((r) => [dayLabel(num(r.day)), { orders: num(r.orders), revenue: money(r.revenue) }]))
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const date = dateLabel(y, m, d - i)
    const e = byDay.get(date) ?? { pageviews: 0, visits: 0, visitors: 0 }
    const o = ordersByDay.get(date) ?? { orders: 0, revenue: 0 }
    series.push({ date, ...e, ...o })
  }

  /* ---- saat / hafta günü / ısı haritası (page_view) ---- */
  const heatRows = await q(
    `SELECT ${WEEKDAY_OF('ts')} AS wd, ${HOUR_OF('ts')} AS hr, COUNT(*) AS n
       FROM analytics_events WHERE type = 'page_view' AND ${IN_RANGE('ts')} GROUP BY wd, hr`,
    cur,
  )
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0))
  const hours = Array(24).fill(0)
  const weekdays = Array(7).fill(0)
  for (const r of heatRows) {
    const wd = num(r.wd)
    const hr = num(r.hr)
    const n = num(r.n)
    if (wd < 0 || wd > 6 || hr < 0 || hr > 23) continue
    heatmap[wd][hr] += n
    hours[hr] += n
    weekdays[wd] += n
  }

  /* ---- paylaşımlar (page_view) ---- */
  const pvWhere = `type = 'page_view' AND ${IN_RANGE('ts')}`
  const [deviceRows, browserRows, osRows, localeRows] = await Promise.all([
    q(`SELECT device, COUNT(*) AS count FROM analytics_events WHERE ${pvWhere} GROUP BY device`, cur),
    q(`SELECT browser, COUNT(*) AS count FROM analytics_events WHERE ${pvWhere} GROUP BY browser`, cur),
    q(`SELECT os, COUNT(*) AS count FROM analytics_events WHERE ${pvWhere} GROUP BY os`, cur),
    q(`SELECT locale, COUNT(*) AS count FROM analytics_events WHERE ${pvWhere} GROUP BY locale`, cur),
  ])
  const deviceCounts = Object.fromEntries(deviceRows.map((r) => [r.device, num(r.count)]))
  const devices = ['desktop', 'mobile', 'tablet', 'other'].map((key) => ({ key, label: DEVICE_LABELS[key], count: deviceCounts[key] ?? 0 }))

  /* ---- kaynaklar / kampanyalar / sayfalar ---- */
  const entryWhere = `type = 'page_view' AND is_entry = 1 AND ${IN_RANGE('ts')}`
  const [referrerRows, campaignRows, pageRows] = await Promise.all([
    q(`SELECT referrer_host AS host, COUNT(*) AS visits FROM analytics_events WHERE ${entryWhere} GROUP BY referrer_host ORDER BY visits DESC LIMIT 10`, cur),
    q(
      `SELECT utm_source, utm_medium, utm_campaign, COUNT(*) AS visits FROM analytics_events
        WHERE ${entryWhere} AND utm_source IS NOT NULL GROUP BY utm_source, utm_medium, utm_campaign ORDER BY visits DESC LIMIT 10`,
      cur,
    ),
    q(
      `SELECT path, COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors FROM analytics_events
        WHERE ${pvWhere} AND path IS NOT NULL GROUP BY path ORDER BY pageviews DESC LIMIT 10`,
      cur,
    ),
  ])

  /* ---- ürünler: görüntülenme/sepet olaylardan, satış order_items'tan, ad products'tan ---- */
  const productRows = await q(
    `SELECT product_id, SUM(type = 'product_view') AS views, SUM(type = 'add_to_cart') AS addToCarts
       FROM analytics_events WHERE type IN ('product_view', 'add_to_cart') AND product_id IS NOT NULL AND ${IN_RANGE('ts')}
      GROUP BY product_id ORDER BY views DESC, addToCarts DESC LIMIT 10`,
    cur,
  )
  const productIds = productRows.map((r) => r.product_id)
  let soldById = new Map()
  let nameById = new Map()
  if (productIds.length) {
    const [soldRows, nameRows] = await Promise.all([
      q(
        `SELECT oi.product_id, SUM(oi.qty) AS ordered, COALESCE(SUM(oi.qty * oi.unit_price), 0) AS revenue
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE o.status IN (${REVENUE_STATUS_SQL}) AND ${IN_RANGE('o.created_at')} AND oi.product_id IN (?)
          GROUP BY oi.product_id`,
        [...cur, productIds],
      ),
      q('SELECT id, name FROM products WHERE id IN (?)', [productIds]),
    ])
    soldById = new Map(soldRows.map((r) => [r.product_id, { ordered: num(r.ordered), revenue: money(r.revenue) }]))
    nameById = new Map(nameRows.map((r) => [r.id, r.name]))
  }
  const products = productRows.map((r) => ({
    productId: r.product_id,
    name: nameById.get(r.product_id) ?? null,
    views: num(r.views),
    addToCarts: num(r.addToCarts),
    ordered: soldById.get(r.product_id)?.ordered ?? 0,
    revenue: soldById.get(r.product_id)?.revenue ?? 0,
  }))

  /* ---- aramalar ---- */
  // meta JSON: MariaDB'de metin, MySQL 8'de JSON — JSON_UNQUOTE(JSON_EXTRACT()) her ikisinde de düz metin verir.
  const searchRows = await q(
    `SELECT LOWER(TRIM(query)) AS q, COUNT(*) AS count,
            SUM(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.results')) = '0') AS zeroResults
       FROM analytics_events WHERE type = 'search' AND query IS NOT NULL AND ${IN_RANGE('ts')}
      GROUP BY q ORDER BY count DESC LIMIT 15`,
    cur,
  )
  const searches = searchRows.filter((r) => r.q).map((r) => ({ query: r.q, count: num(r.count), zeroResults: num(r.zeroResults) }))

  /* ---- huni: onaylı oturum varsa oturum bazlı, yoksa olay sayıları ---- */
  const [funnelRow] = await q(
    `SELECT SUM(type = 'page_view') AS e_pageview, SUM(type = 'product_view') AS e_product, SUM(type = 'add_to_cart') AS e_cart,
            SUM(type = 'checkout_start') AS e_checkout, SUM(type = 'order_complete') AS e_order,
            COUNT(DISTINCT CASE WHEN type = 'page_view' THEN session_id END) AS s_pageview,
            COUNT(DISTINCT CASE WHEN type = 'product_view' THEN session_id END) AS s_product,
            COUNT(DISTINCT CASE WHEN type = 'add_to_cart' THEN session_id END) AS s_cart,
            COUNT(DISTINCT CASE WHEN type = 'checkout_start' THEN session_id END) AS s_checkout,
            COUNT(DISTINCT CASE WHEN type = 'order_complete' THEN session_id END) AS s_order
       FROM analytics_events WHERE ${IN_RANGE('ts')}`,
    cur,
  )
  const sessionBasis = kpis.sessions.value > 0
  const f = funnelRow ?? {}
  const funnel = sessionBasis
    ? { basis: 'sessions', pageview: num(f.s_pageview), productView: num(f.s_product), addToCart: num(f.s_cart), checkout: num(f.s_checkout), order: num(f.s_order) }
    : { basis: 'events', pageview: num(f.e_pageview), productView: num(f.e_product), addToCart: num(f.e_cart), checkout: num(f.e_checkout), order: num(f.e_order) }

  /* ---- çerez onayı kararları ---- */
  const [consentRow] = await q(
    `SELECT COUNT(*) AS decisions,
            SUM(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.choice')) = 'all') AS acceptAll,
            SUM(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.choice')) = 'necessary') AS necessaryOnly,
            SUM(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.choice')) = 'custom') AS custom,
            SUM(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.analytics')) = 'true') AS analyticsOptIn
       FROM analytics_events WHERE type = 'consent' AND ${IN_RANGE('ts')}`,
    cur,
  )
  const c = consentRow ?? {}
  const consent = { decisions: num(c.decisions), acceptAll: num(c.acceptAll), necessaryOnly: num(c.necessaryOnly), custom: num(c.custom), analyticsOptIn: num(c.analyticsOptIn) }

  /* ---- satışlar ---- */
  const revWhere = `status IN (${REVENUE_STATUS_SQL}) AND ${IN_RANGE('created_at')}`
  const [statusRows, [salesRow], couponRows, cityRows, orderHourRows, orderLocaleRows] = await Promise.all([
    q(`SELECT status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status <> 'demo' AND ${IN_RANGE('created_at')} GROUP BY status`, cur),
    q(
      `SELECT SUM(customer_id IS NOT NULL) AS memberOrders, SUM(customer_id IS NULL) AS guestOrders,
              SUM(coupon_code IS NOT NULL) AS couponOrders, SUM(discount_amount > 0) AS firstOrderDiscountOrders
         FROM orders WHERE ${revWhere}`,
      cur,
    ),
    q(
      `SELECT coupon_code AS code, COUNT(*) AS count, COALESCE(SUM(coupon_discount), 0) AS discount
         FROM orders WHERE coupon_code IS NOT NULL AND ${revWhere} GROUP BY coupon_code ORDER BY count DESC, discount DESC LIMIT 5`,
      cur,
    ),
    q(`SELECT city, COUNT(*) AS count FROM orders WHERE ${revWhere} GROUP BY city ORDER BY count DESC LIMIT 8`, cur),
    q(`SELECT ${HOUR_OF('created_at')} AS hr, COUNT(*) AS n FROM orders WHERE ${revWhere} GROUP BY hr`, cur),
    q(`SELECT locale, COUNT(*) AS count FROM orders WHERE ${revWhere} GROUP BY locale`, cur),
  ])
  const statusMap = new Map(statusRows.map((r) => [r.status, r]))
  const byHour = Array(24).fill(0)
  for (const r of orderHourRows) {
    const hr = num(r.hr)
    if (hr >= 0 && hr < 24) byHour[hr] += num(r.n)
  }
  const s = salesRow ?? {}
  const sales = {
    byStatus: SALES_STATUSES.map((status) => ({ status, count: num(statusMap.get(status)?.count), revenue: money(statusMap.get(status)?.revenue) })),
    memberOrders: num(s.memberOrders),
    guestOrders: num(s.guestOrders),
    couponOrders: num(s.couponOrders),
    firstOrderDiscountOrders: num(s.firstOrderDiscountOrders),
    topCoupons: couponRows.map((r) => ({ code: r.code, count: num(r.count), discount: money(r.discount) })),
    byCity: cityRows.map((r) => ({ city: r.city, count: num(r.count) })),
    byHour,
    byLocale: localeShares(orderLocaleRows),
  }

  /* ---- müşteriler ---- */
  const [[customerRow], newCustomerRows, [buyerRow]] = await Promise.all([
    q(`SELECT COUNT(*) AS total, SUM(${IN_RANGE('created_at')}) AS newInRange FROM customers`, cur),
    q(`SELECT ${DAY_OF('created_at')} AS day, COUNT(*) AS count FROM customers WHERE ${IN_RANGE('created_at')} GROUP BY day`, cur),
    q(
      `SELECT COUNT(*) AS buyers, COALESCE(SUM(cnt >= 2), 0) AS repeatBuyers
         FROM (SELECT LOWER(email) AS e, COUNT(*) AS cnt FROM orders WHERE ${revWhere} GROUP BY LOWER(email)) t`,
      cur,
    ),
  ])
  const newByDay = new Map(newCustomerRows.map((r) => [dayLabel(num(r.day)), num(r.count)]))
  const newSeries = series.map(({ date }) => ({ date, count: newByDay.get(date) ?? 0 }))
  const customers = {
    total: num(customerRow?.total),
    newInRange: num(customerRow?.newInRange),
    newSeries,
    buyersInRange: num(buyerRow?.buyers),
    repeatBuyers: num(buyerRow?.repeatBuyers),
  }

  return {
    range,
    from,
    to,
    days,
    generatedAt: new Date().toISOString(),
    tracking: {
      since: sinceEpoch == null ? null : new Date(sinceEpoch * 1000).toISOString(),
      events: num(eventsRow?.n),
      consentedShare: pageviews > 0 ? Math.round((num(ev.consented) / pageviews) * 10000) / 10000 : 0,
      retentionDays,
    },
    kpis,
    series,
    hours,
    weekdays,
    heatmap,
    devices,
    browsers: topShares(browserRows, 'browser'),
    os: topShares(osRows, 'os'),
    locales: localeShares(localeRows),
    referrers: referrerRows.map((r) => ({ host: r.host ?? null, visits: num(r.visits) })),
    campaigns: campaignRows.map((r) => ({ source: r.utm_source, medium: r.utm_medium ?? null, campaign: r.utm_campaign ?? null, visits: num(r.visits) })),
    pages: pageRows.map((r) => ({ path: r.path, pageviews: num(r.pageviews), visitors: num(r.visitors) })),
    products,
    searches,
    funnel,
    consent,
    sales,
    customers,
  }
}
