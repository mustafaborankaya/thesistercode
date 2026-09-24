import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, SelectField } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { allProducts, categories } from '../../data/catalog'
import { mediaByName, productMediaName } from '../../data/media'
import type { Product } from '../../data/types'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { formatPrice } from '../../lib/format'
import { createAdminProduct, getAdminSettings, listAdminProducts, useApiMode, type AdminProduct } from '../adminApi'
import { inventoryConfigFrom, localInventoryConfig, productStockInfo } from '../inventory'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

const creatableCategories = categories.filter((c) => !c.virtual)

const filterableCategories = categories.filter((c) => !c.virtual)


function hasImage(product: Product): boolean {
  // API modunda ürün doğrudan sunucudan gelir; ön görsel media[0] olarak sabittir (bkz. api/src/services/products.js).
  if (useApiMode) return product.media[0]?.src != null
  return mediaByName(productMediaName(product.number, 'front')) != null
}

/** `/admin/urunler` — tüm ürünler (gizlenenler dahil), arama ve kategori filtresi. */
export function ProductsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [apiProducts, setApiProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(useApiMode)
  const [addCategory, setAddCategory] = useState<string>(creatableCategories[0]?.id ?? '')
  const [addPending, setAddPending] = useState(false)
  const [threshold, setThreshold] = useState(() => localInventoryConfig().lowStockThreshold)

  // API modunda eşik yönetici ayarından (public /settings'te yok); hata olursa varsayılan kalır.
  useEffect(() => {
    if (!useApiMode) return
    getAdminSettings()
      .then((raw) => setThreshold(inventoryConfigFrom(raw).lowStockThreshold))
      .catch(() => undefined)
  }, [])

  async function handleAdd() {
    if (!addCategory) return
    setAddPending(true)
    setError(null)
    try {
      // Yeni ürün admin doldurana kadar mağazada GİZLİ kalır — aksi halde 0 TL fiyatlı, adı/görseli
      // olmayan bir ürün anında müşterilere görünür olurdu (stok 0 olsa bile listede/kategori sayfasında görünür).
      const product = await createAdminProduct({ category: addCategory as Product['category'], price: 0, hidden: true })
      navigate(`/admin/urunler/${product.id}`)
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setAddPending(false)
    }
  }

  useEffect(() => {
    if (!useApiMode) return
    let cancelled = false
    setLoading(true)
    listAdminProducts()
      .then((products) => {
        if (cancelled) return
        setApiProducts(products)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const source = useApiMode ? (apiProducts ?? []) : allProducts

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return source.filter((p) => {
      if (category && p.category !== category) return false
      if (!q) return true
      return p.name.toLowerCase().includes(q) || p.number.includes(q)
    })
  }, [source, query, category])

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.products.title}</h1>
      </div>
      {useApiMode ? null : <p className={styles.demoNotice}>{AS.demoNotice}</p>}

      <div className={styles.filters}>
        <Field
          className={styles.filterField}
          label={AS.products.searchLabel}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={AS.products.searchPlaceholder}
        />
        <SelectField className={styles.filterField} label={AS.products.categoryLabel} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{AS.products.allCategories}</option>
          {filterableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>
      </div>

      {useApiMode ? (
        <div className={styles.filters} style={{ alignItems: 'flex-end' }}>
          <SelectField className={styles.filterField} label={AS.products.addCategoryLabel} value={addCategory} onChange={(e) => setAddCategory(e.target.value)}>
            {creatableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </SelectField>
          <Button variant="secondary" disabled={addPending} onClick={() => void handleAdd()}>
            {AS.products.add}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className={styles.empty}>{AS.common.loading}</p>
      ) : error ? (
        <p className={styles.empty} role="alert">
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>{AS.products.empty}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{AS.products.number}</th>
                <th scope="col">{AS.products.name}</th>
                <th scope="col">{AS.products.category}</th>
                <th scope="col">{AS.products.price}</th>
                <th scope="col">{AS.products.stock}</th>
                <th scope="col">{AS.products.isNew}</th>
                <th scope="col">{AS.products.hidden}</th>
                <th scope="col">{AS.products.hasImage}</th>
                <th scope="col">
                  <span className="sr-only">{AS.products.edit}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const catLabel = categories.find((c) => c.id === p.category)?.label ?? p.category
                return (
                  <tr key={p.id}>
                    <td>{p.number}</td>
                    <td>{p.name}</td>
                    <td>{catLabel}</td>
                    <td>{formatPrice(p.price)}</td>
                    <td>
                      <StockCell product={p} threshold={threshold} />
                    </td>
                    <td>
                      {p.isNew ? (
                        <span className={styles.status}>
                          <Icon name="check" size={14} /> {AS.common.yes}
                          {(p as Partial<AdminProduct>).newBadge === 'auto' ? <span className="text-soft"> ({AS.products.newAuto})</span> : null}
                        </span>
                      ) : (
                        <span className={styles.statusMuted}>
                          <Icon name="close" size={14} /> {AS.common.no}
                        </span>
                      )}
                    </td>
                    <td>
                      {p.hidden ? (
                        <span className={styles.status}>
                          <Icon name="eye-off" size={14} /> {AS.common.yes}
                        </span>
                      ) : (
                        <span className={styles.statusMuted}>
                          <Icon name="eye" size={14} /> {AS.common.no}
                        </span>
                      )}
                    </td>
                    <td>
                      {hasImage(p) ? (
                        <span className={styles.status}>
                          <Icon name="check" size={14} /> {AS.common.yes}
                        </span>
                      ) : (
                        <span className={styles.statusMuted}>
                          <Icon name="info" size={14} /> {AS.common.no}
                        </span>
                      )}
                    </td>
                    <td>
                      <Link className="link" to={`/admin/urunler/${p.id}`}>
                        {AS.products.edit}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Toplam stok + düşük stok / tükendi rozeti (kural: bkz. ../inventory.ts). */
function StockCell({ product, threshold }: { product: Product; threshold: number }) {
  const info = productStockInfo(product, threshold)
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span>{info.total}</span>
      {info.soldOut ? (
        <span className={[styles.stockFlag, styles.stockFlagOut].join(' ')}>{AS.products.soldOut}</span>
      ) : info.low > 0 ? (
        <span className={styles.stockFlag} title={AS.products.lowStockTitle(info.low, threshold)}>
          {AS.products.lowStock}
        </span>
      ) : null}
    </span>
  )
}
