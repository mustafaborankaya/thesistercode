import { Link } from 'react-router-dom'
import { CategoryStrip } from '../components/collection/CategoryStrip'
import { InfoBlock } from '../components/home/InfoBlock'
import { ProductGrid } from '../components/product/ProductCard'
import { ProductionSection } from '../components/production/ProductionSection'
import { Button } from '../components/ui/Button'
import { ContentText } from '../components/ui/ContentText'
import { MediaSlot } from '../components/ui/MediaSlot'
import { products } from '../data/catalog'
import { brandContent } from '../data/content'
import { brandMedia } from '../data/media'
import { S } from '../i18n'
import styles from './HomePage.module.css'

const FEATURED_COUNT = 8

/**
 * Tam ekran açılış fotoğrafı (src/assets/media/acilis-masaustu.jpg + acilis-mobil.jpg). Header bu alanın
 * üstünde şeffaf durur (Layout → data-under-header). Görselin alt ortasında yalnızca yazıdan oluşan tek bağlantı:
 * panelden `brand.heroCta` doluysa o, boşsa "Koleksiyonu keşfet". Fotoğraf yokken alan açık gri kalır.
 */
function Hero() {
  const desktop = brandMedia.heroDesktop
  const mobile = brandMedia.heroMobile
  const hasPhoto = !!(desktop || mobile)
  return (
    <section className={styles.hero} data-photo={hasPhoto} aria-labelledby="hero-title">
      {hasPhoto ? (
        <picture>
          {mobile ? <source media="(max-width: 1023px)" srcSet={mobile} /> : null}
          <img src={desktop ?? mobile ?? undefined} alt="" className={styles.heroImg} fetchPriority="high" />
        </picture>
      ) : (
        <p className={styles.heroPending}>
          {S.common.heroPhotoPending}
          <br />
          <code>acilis-masaustu.jpg</code> · <code>acilis-mobil.jpg</code>
        </p>
      )}
      <h1 id="hero-title" className="sr-only">
        {brandContent.collectionTitle.value ?? S.common.heroTitle}
      </h1>
      <Link to="/koleksiyon" className={styles.heroLink}>
        {brandContent.heroCta.value ?? S.common.heroDiscover}
      </Link>
    </section>
  )
}

/**
 * Ana sayfa akışı: açılış fotoğrafı → kategori şeridi → öne çıkan ürünler → koleksiyon tanıtımı →
 * üretim bölümü (#uretim) → bilgilendirme → footer (Layout). Filtre araçları koleksiyon sayfasındadır.
 */
export function HomePage() {
  const featured = [...products.filter((p) => p.isNew), ...products.filter((p) => !p.isNew)].slice(0, FEATURED_COUNT)

  return (
    <div>
      <Hero />

      <section className={styles.featured} aria-labelledby="featured-title">
        <div className={styles.stripRow}>
          <CategoryStrip activeId="tum-urunler" />
        </div>
        <div className={styles.featuredHead}>
          <h2 id="featured-title" className={styles.featuredTitle}>
            {S.common.homeFeaturedTitle}
          </h2>
          <Link to="/koleksiyon/yeni-gelenler" className={styles.featuredLink}>
            {S.header.collections}
          </Link>
        </div>
        <ProductGrid products={featured} />
        <div className={styles.featuredFooter}>
          <Button variant="secondary" to="/koleksiyon">
            {S.common.homeSeeAll}
          </Button>
        </div>
      </section>

      <section className={styles.intro} aria-label={brandContent.collectionVisual.label}>
        <MediaSlot label={brandContent.collectionVisual.label} src={brandMedia.collection} ratio="16 / 10" />
        <div className={styles.introText}>
          <h2 className={styles.introTitle}>{brandContent.collectionTitle.value ?? S.common.heroTitle}</h2>
          <ContentText field={brandContent.collectionIntro} as="p" className="text-soft" />
          <div>
            <Link to="/koleksiyon" className="link caps">
              {S.common.heroCta}
            </Link>
          </div>
        </div>
      </section>

      <ProductionSection />
      <InfoBlock />
    </div>
  )
}
