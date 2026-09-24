import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductGrid } from '../components/product/ProductCard'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { S } from '../i18n'
import { searchProducts } from '../lib/catalog'
import styles from './Page.module.css'

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const [value, setValue] = useState(q)

  useEffect(() => {
    setValue(q)
  }, [q])

  const results = q.trim() ? searchProducts(q) : []

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next = value.trim()
    setSearchParams(next ? { q: next } : {})
  }

  return (
    <div className={styles.page}>
      <form role="search" onSubmit={handleSubmit} className={[styles.narrow, 'stack'].join(' ')} style={{ marginInline: 'auto', marginBottom: 'var(--sp-10)' }}>
        <Field
          label={S.search.label}
          type="search"
          placeholder={S.search.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="submit" variant="primary" block>
          {S.search.submit}
        </Button>
      </form>

      <h1 className={[styles.title, styles.titleCenter].join(' ')}>{q ? S.search.resultsFor(q) : S.search.title}</h1>
      {q ? (
        <p className="text-soft" style={{ textAlign: 'center', marginBottom: 'var(--sp-8)' }}>
          {S.search.resultCount(results.length)}
        </p>
      ) : null}

      <ProductGrid
        products={results}
        empty={
          q ? (
            <div style={{ textAlign: 'center', padding: 'var(--sp-16) 0' }}>
              <p>{S.search.noResults}</p>
              <p className="text-soft">{S.search.noResultsHint}</p>
            </div>
          ) : (
            <p className="text-soft" style={{ textAlign: 'center', padding: 'var(--sp-16) 0' }}>
              {S.search.recentless}
            </p>
          )
        }
      />
    </div>
  )
}
