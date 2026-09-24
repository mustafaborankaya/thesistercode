import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Field, SelectField } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { allProducts, categories } from '../../data/catalog'
import { mediaByName, productMediaName } from '../../data/media'
import type { Product } from '../../data/types'
import { formatPrice } from '../../lib/format'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

const filterableCategories = categories.filter((c) => !c.virtual)

function totalStock(product: Product): number {
  let total = 0
  for (const sizes of Object.values(product.stock)) {
    for (const qty of Object.values(sizes)) total += qty ?? 0
  }
  return total
}

/** `/admin/urunler` — tüm ürünler (gizlenenler dahil), arama ve kategori filtresi. */
export function ProductsPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allProducts.filter((p) => {
      if (category && p.category !== category) return false
      if (!q) return true
      return p.name.toLowerCase().includes(q) || p.number.includes(q)
    })
  }, [query, category])

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.products.title}</h1>
      </div>
      <p className={styles.demoNotice}>{AS.demoNotice}</p>

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

      {filtered.length === 0 ? (
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
                const hasImage = mediaByName(productMediaName(p.number, 'front')) != null
                return (
                  <tr key={p.id}>
                    <td>{p.number}</td>
                    <td>{p.name}</td>
                    <td>{catLabel}</td>
                    <td>{formatPrice(p.price)}</td>
                    <td>{totalStock(p)}</td>
                    <td>
                      {p.isNew ? (
                        <span className={styles.status}>
                          <Icon name="check" size={14} /> {AS.common.yes}
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
                      {hasImage ? (
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
