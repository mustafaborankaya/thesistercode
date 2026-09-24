import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AccordionItem } from '../components/ui/Accordion'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Price } from '../components/ui/Price'
import { ColorSelector } from '../components/product/ColorSelector'
import { CompleteLook } from '../components/product/CompleteLook'
import { Gallery } from '../components/product/Gallery'
import { Lightbox } from '../components/product/Lightbox'
import { MobileBuyBar } from '../components/product/MobileBuyBar'
import { MobileGallery } from '../components/product/MobileGallery'
import { SimilarProducts } from '../components/product/SimilarProducts'
import { SizeGuideDrawer } from '../components/product/SizeGuideDrawer'
import { SizeSelector } from '../components/product/SizeSelector'
import { useVariantSelection } from '../components/product/useVariantSelection'
import { productBySlug } from '../data/catalog'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { S } from '../i18n'
import { getCompleteLook } from '../lib/recommendations'
import { useFavorites } from '../state/FavoritesContext'
import { usePanels } from '../state/PanelContext'
import { NotFoundPage } from './NotFoundPage'
import styles from './ProductPage.module.css'

/** Yer tutucu metinlere "içerik eklenecek" eki gelir; panelden/DB'den gelen gerçek metin olduğu gibi gösterilir. */
function withPending(text: string, placeholder: string): string {
  return text === placeholder ? S.info.pendingField(text) : text
}

/** Bilgi sütununun içeriği, üst boşluk (header + demo bar + 24px) çıkarılmış ekrana sığıyor mu? */
function useInfoFits(isDesktop: boolean): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(false)

  useEffect(() => {
    if (!isDesktop) {
      setFits(false)
      return
    }
    const el = ref.current
    if (!el) return

    const cssPx = (name: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0

    const measure = () => {
      const available = window.innerHeight - cssPx('--header-h') - 48
      const next = el.offsetHeight <= available
      setFits((prev) => (prev === next ? prev : next))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [isDesktop])

  return [ref, fits]
}

export function ProductPage() {
  const { slug } = useParams()
  const product = slug ? productBySlug[slug] : undefined
  const isDesktop = useIsDesktop()
  const { openPanel } = usePanels()
  const { has, toggle } = useFavorites()
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [infoRef, infoFits] = useInfoFits(isDesktop)

  // Hook'lar koşulsuz çağrılmalı; ürün yoksa aşağıda NotFoundPage döneriz.
  const fallbackProduct = product ?? Object.values(productBySlug)[0]
  const variant = useVariantSelection(fallbackProduct)

  useEffect(() => {
    setGalleryIndex(0)
  }, [product?.id])

  if (!product) return <NotFoundPage />

  const isFav = has(product.id)
  // NOT: bu max=3, CompleteLook bileşeninin kendi içindeki getCompleteLook(product, 3) çağrısıyla
  // aynı olmalı — aksi hâlde bir ürün hem "Kombini Tamamla" hem "Benzer Ürünler"de görünebilir.
  const completeLookIds = getCompleteLook(product, 3).map((p) => p.id)

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.galleryCol}>
          {isDesktop ? (
            <Gallery media={product.media} index={galleryIndex} onIndexChange={setGalleryIndex} onOpenLightbox={() => openPanel('lightbox')} />
          ) : (
            <MobileGallery media={product.media} />
          )}
        </div>

        <div ref={infoRef} className={[styles.info, infoFits ? styles.sticky : ''].join(' ').trim()}>
          <div className={styles.header}>
            <div>
              <p className={styles.eyebrow}>{S.product.productNumber(product.number)}</p>
              <h1 className={styles.name}>{product.name}</h1>
            </div>
            <button
              type="button"
              className={styles.favButton}
              aria-pressed={isFav}
              aria-label={`${isFav ? S.collection.removeFromFavorites : S.collection.addToFavorites} — ${product.name}`}
              onClick={() => toggle(product.id)}
            >
              <Icon name={isFav ? 'heart-filled' : 'heart'} size={22} />
            </button>
          </div>

          <Price amount={product.price} className={styles.price} />

          <div className={styles.purchase}>
            <ColorSelector colors={product.colors} value={variant.colorId} onChange={variant.setColor} />
            <SizeSelector
              product={product}
              value={variant.size}
              onChange={variant.setSize}
              stockForSize={variant.stockForSize}
              error={variant.error}
              groupRef={variant.sizeGroupRef}
            />

            <Button variant="primary" block onClick={variant.submit} disabled={variant.pending} aria-busy={variant.pending}>
              {S.product.addToCart}
            </Button>

            <div className={styles.status}>
              {variant.error === 'stock-limit' ? (
                <p role="alert" className={styles.statusError}>
                  {S.product.stockLimit}
                </p>
              ) : variant.error === 'sold-out' ? (
                <p role="alert" className={styles.statusError}>
                  {S.product.soldOut}
                </p>
              ) : variant.added ? (
                <p aria-live="polite" className={styles.statusOk}>
                  {S.product.added}
                </p>
              ) : null}
            </div>

            {variant.lowStock != null ? <p className={styles.lowStock}>{S.product.lowStock(variant.lowStock)}</p> : null}
          </div>

          <div className={styles.accordions}>
            <AccordionItem title={S.product.description} defaultOpen>
              <p className="text-soft">{withPending(product.content.description, S.data.productContent.description(product.number))}</p>
            </AccordionItem>
            <AccordionItem title={S.product.fabricCare}>
              <p className="text-soft">{withPending(product.content.fabricCare, S.data.productContent.fabricCare(product.number))}</p>
            </AccordionItem>
            <AccordionItem title={S.product.deliveryReturns}>
              <p className="text-soft">{withPending(product.content.deliveryReturns, S.data.productContent.deliveryReturns)}</p>
            </AccordionItem>
          </div>

          <CompleteLook key={`cl-${product.id}`} product={product} />
          <SimilarProducts key={`sp-${product.id}`} product={product} exclude={completeLookIds} />
        </div>
      </div>

      {isDesktop ? <Lightbox media={product.media} index={galleryIndex} onIndexChange={setGalleryIndex} /> : null}
      <SizeGuideDrawer />

      {!isDesktop ? (
        <MobileBuyBar price={product.price} size={variant.size} pending={variant.pending} onAddToCart={variant.submit} sizeGroupRef={variant.sizeGroupRef} />
      ) : null}
    </div>
  )
}
