/**
 * HEAD ETİKET YÖNETİCİSİ — tek yerden `document.title`, meta/link ve JSON-LD etiketlerini günceller.
 *
 * React 19'un `<title>`/`<meta>` hoisting'i KULLANILMAZ (sayfalar arasında çakışma/çift etiket olmasın);
 * tüm etiketler `data-seo` ile işaretlenir: index.html'deki varsayılanlar ve bot önizlemesinin sunucuda
 * bastığı etiketler de bu işareti taşır, bu yüzden aynı seçiciyle bulunup yerinde güncellenir.
 * Dokunulmayan eski `data-seo` etiketleri (örn. ürün sayfasından kalan `product:price:*`) kaldırılır.
 */
import type { PageMeta } from './seo'

const MARK = 'data-seo'

type Attrs = Record<string, string>

function upsert(head: HTMLHeadElement, touched: Set<Element>, selector: string, tag: 'meta' | 'link', attrs: Attrs): void {
  let el = head.querySelector(selector)
  if (!el) {
    el = document.createElement(tag)
    head.appendChild(el)
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (el.getAttribute(key) !== value) el.setAttribute(key, value)
  }
  if (!el.hasAttribute(MARK)) el.setAttribute(MARK, '')
  touched.add(el)
}

/** Sayfa metasını belgeye uygular (idempotent — StrictMode çift çalıştırmasında sorun çıkarmaz). */
export function applySeo(meta: PageMeta): void {
  const head = document.head
  const touched = new Set<Element>()
  const byName = (name: string, content: string) => upsert(head, touched, `meta[name="${name}"]`, 'meta', { name, content })
  const byProp = (property: string, content: string) => upsert(head, touched, `meta[property="${property}"]`, 'meta', { property, content })

  document.title = meta.title
  byName('description', meta.description)
  byName('robots', meta.robots)

  if (meta.canonical) upsert(head, touched, 'link[rel="canonical"]', 'link', { rel: 'canonical', href: meta.canonical })
  if (meta.alternates) {
    const pairs: [string, string][] = [
      ['tr', meta.alternates.tr],
      ['en', meta.alternates.en],
      ['x-default', meta.alternates.tr],
    ]
    for (const [hreflang, href] of pairs) {
      upsert(head, touched, `link[rel="alternate"][hreflang="${hreflang}"]`, 'link', { rel: 'alternate', hreflang, href })
    }
  }

  byProp('og:site_name', meta.siteName)
  byProp('og:locale', meta.ogLocale)
  byProp('og:type', meta.og.type)
  if (meta.og.url) byProp('og:url', meta.og.url)
  byProp('og:title', meta.og.title)
  byProp('og:description', meta.og.description)
  byProp('og:image', meta.og.image)
  byProp('og:image:alt', meta.og.imageAlt)
  if (meta.og.imageWidth) byProp('og:image:width', String(meta.og.imageWidth))
  if (meta.og.imageHeight) byProp('og:image:height', String(meta.og.imageHeight))
  if (meta.og.price) {
    byProp('product:price:amount', meta.og.price.amount)
    byProp('product:price:currency', meta.og.price.currency)
  }

  byName('twitter:card', 'summary_large_image')
  byName('twitter:title', meta.og.title)
  byName('twitter:description', meta.og.description)
  byName('twitter:image', meta.og.image)
  byName('twitter:image:alt', meta.og.imageAlt)

  // Bu sayfada üretilmeyen eski meta/link etiketleri kaldırılır (script'ler aşağıda ayrıca yenilenir).
  for (const el of Array.from(head.querySelectorAll(`[${MARK}]`))) {
    if (!touched.has(el) && el.tagName !== 'SCRIPT') el.remove()
  }

  // JSON-LD: önce eski data-seo düğümleri temizlenir, sonra yenileri eklenir. CSP `script-src 'self'`
  // bunu engellemez; application/ld+json çalıştırılmaz, yalnızca okunur.
  for (const el of Array.from(head.querySelectorAll(`script[type="application/ld+json"][${MARK}]`))) el.remove()
  for (const obj of meta.jsonLd) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute(MARK, '')
    script.textContent = JSON.stringify(obj).replace(/</g, '\\u003c')
    head.appendChild(script)
  }
}
