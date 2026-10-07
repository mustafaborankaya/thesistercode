/**
 * ROTA DÜZEYİNDE SEO — sayfa dosyalarına dokunmadan App.tsx'te her mağaza rotasını sarar:
 *   <Route path="/urun/:slug" element={<RouteSeo page="product"><ProductPage /></RouteSeo>} />
 * Veriyi katalog/içerik/ayar modüllerinden okur (hepsi açılışta senkron yüklenir), `pageMeta` ile
 * başlık/açıklama/JSON-LD üretir ve `<Seo>` ile belgeye uygular. Yönetici panelinin içerik önizlemesinde
 * taslak değişince (`usePreviewVersion`) meta da yeniden üretilir.
 */
import { useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { parseFaq } from '../components/info/parseFaq'
import { siteSettings } from '../config/settings'
import { productBySlug, products } from '../data/catalog'
import { brandContent, infoPageBySlug, usePreviewVersion } from '../data/content'
import type { MediaKind, Product } from '../data/types'
import { locale } from '../i18n'
import { isCategoryId, productInCategory } from '../lib/catalog'
import { SeoHead } from './SeoHead'
import { pageMeta, type SeoBrand, type SeoData, type SeoEnv, type SeoPageId, type SeoProduct, type SeoRoute } from './seo'
import templates from './templates.json'

export type RouteSeoPage = 'home' | 'collection' | 'product' | 'info' | 'notFound' | SeoPageId

/** Mutlak URL kökü: canlıda https://teshvikiye.com, yerelde localhost (önizleme için sorun değil). */
const env: SeoEnv = { origin: window.location.origin, locale, templates }

/** JSON-LD/og görselleri: ön, arka, model (kumaş detayı hariç). */
const IMAGE_KINDS: MediaKind[] = ['front', 'back', 'model']

/** Pakete gömülü (`/assets/...`), yüklenmiş (`/uploads/...`) ya da tam URL → mutlak; blob:/data: (yerel panel önizlemesi) atlanır. */
function absoluteImage(src: string | null): string | null {
  if (!src || /^(blob|data):/i.test(src)) return null
  try {
    return new URL(src, window.location.origin).href
  } catch {
    return null
  }
}

function toSeoProduct(p: Product): SeoProduct {
  const bySlot: Partial<Record<MediaKind, string | null>> = {}
  for (const m of p.media) bySlot[m.kind] = m.src
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    colorCount: p.colors.length,
    inStock: Object.values(p.stock).some((sizes) => Object.values(sizes).some((qty) => (qty ?? 0) > 0)),
    images: IMAGE_KINDS.map((kind) => absoluteImage(bySlot[kind] ?? null)).filter((u): u is string => !!u),
    description: p.content.description,
  }
}

/** `value` getter'ları önizleme taslağını okur — her hesaplamada taze çağrılır. */
function brandData(): SeoBrand {
  return {
    collectionTitle: brandContent.collectionTitle.value,
    collectionIntro: brandContent.collectionIntro.value,
    companyName: brandContent.companyName.value,
    address: brandContent.address.value,
    phone: brandContent.phone.value,
    email: brandContent.email.value,
  }
}

function buildRoute(page: RouteSeoPage, slug: string | undefined, categoryId: string | undefined): SeoRoute {
  switch (page) {
    case 'home':
      return { kind: 'home' }
    case 'collection':
      return { kind: 'collection', categoryId: categoryId ?? 'tum-urunler' }
    case 'product':
      return { kind: 'product', slug: slug ?? '' }
    case 'info':
      return { kind: 'info', slug: slug ?? '' }
    case 'notFound':
      return { kind: 'notFound' }
    default:
      return { kind: 'page', id: page }
  }
}

function buildData(route: SeoRoute): SeoData {
  const data: SeoData = { brand: brandData(), social: siteSettings.social }
  if (route.kind === 'product') {
    const product = productBySlug[route.slug]
    data.product = product ? toSeoProduct(product) : null
  } else if (route.kind === 'collection') {
    const categoryId = route.categoryId
    data.products = isCategoryId(categoryId) ? products.filter((p) => productInCategory(p, categoryId)).map(toSeoProduct) : []
  } else if (route.kind === 'info') {
    const slug = (templates.infoAliases as Record<string, string | undefined>)[route.slug] ?? route.slug
    const page = infoPageBySlug[slug]
    data.info = page ? { slug, sections: page.sections.map((s) => s.value) } : null
    if (page && slug === 'sss') data.faq = page.sections.flatMap((s) => parseFaq(s.value).items)
  }
  return data
}

export function RouteSeo({ page, children }: { page: RouteSeoPage; children: ReactNode }) {
  const { slug, categoryId } = useParams<{ slug?: string; categoryId?: string }>()
  const previewVersion = usePreviewVersion()
  const meta = useMemo(() => {
    const route = buildRoute(page, slug, categoryId)
    return pageMeta(route, buildData(route), env)
    // previewVersion: içerik önizlemesi taslağı değişince yeniden üret (değer kendisi kullanılmaz).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, slug, categoryId, previewVersion])
  return (
    <>
      <SeoHead meta={meta} />
      {children}
    </>
  )
}
