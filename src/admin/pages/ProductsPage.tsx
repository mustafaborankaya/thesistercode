import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { allProducts, categories } from '../../data/catalog'
import { mediaByName, productMediaName } from '../../data/media'
import type { Product } from '../../data/types'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { createAdminProduct, getAdminSettings, listAdminProducts, updateAdminProduct, useApiMode, type AdminProduct } from '../adminApi'
import { AS } from '../adminStrings'
import { inventoryConfigFrom, localInventoryConfig, productStockInfo } from '../inventory'
import { isConflict, withExpected } from '../productUtils'
import { AdminIcon } from '../ui/AdminIcon'
import { Btn } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DataTable, type Column } from '../ui/DataTable'
import { FilterBar, FilterSelect } from '../ui/FilterBar'
import { SelectField, TextField } from '../ui/Form'
import { EmptyState, ErrorState, Notice, PageHeader } from '../ui/Page'
import { StatusBadge } from '../ui/StatusBadge'
import { formatPrice, parseAmount } from '../ui/format'
import { useToast } from '../ui/toastContext'
import { useLoader } from '../ui/useLoader'
import ui from '../ui/ui.module.css'
import styles from '../admin.module.css'

type Row = Product & Partial<Pick<AdminProduct, 'newBadge' | 'nameEn'>> & { updatedAt?: string }

const editableCategories = categories.filter((c) => !c.virtual)
const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id

function thumbOf(p: Row): string | null {
  // API modunda ürün doğrudan sunucudan gelir (media[].src); yerelde dosya/IndexedDB adı kuralı.
  // Sunucuda URL yoksa mağazayla aynı şekilde paketlenmiş dosyaya düşülür (bkz. data/catalog.ts).
  if (useApiMode) return p.media.find((m) => m.kind === 'front')?.src ?? mediaByName(productMediaName(p.number, 'front'))
  return mediaByName(productMediaName(p.number, 'front'))
}

/** `/admin/urunler` — arama + filtreler, satır içi fiyat, toplu gizle/göster, stok ve rozet sütunları. */
export function ProductsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [stock, setStock] = useState<'' | 'ok' | 'low' | 'out'>(() => { const s = params.get('stok'); return s === 'ok' || s === 'low' || s === 'out' ? s : '' })
  const [visibility, setVisibility] = useState<'' | 'visible' | 'hidden'>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPending, setBulkPending] = useState(false)
  const [creating, setCreating] = useState(() => useApiMode && params.get('yeni') === '1')
  const [zeroPrice, setZeroPrice] = useState<{ row: Row } | null>(null)

  const products = useLoader<Row[]>(() => (useApiMode ? listAdminProducts() : Promise.resolve(allProducts)) as Promise<Row[]>)
  // Eşik yönetici ayarından (public /settings'te yok); hata olursa varsayılan kalır.
  const settings = useLoader(() => (useApiMode ? getAdminSettings().then((raw) => inventoryConfigFrom(raw).lowStockThreshold) : Promise.resolve(localInventoryConfig().lowStockThreshold)))
  const threshold = settings.data ?? localInventoryConfig().lowStockThreshold

  const rows = products.data ?? null
  const filtered = useMemo(() => {
    if (!rows) return null
    const q = query.trim().toLocaleLowerCase('tr-TR')
    return rows.filter((p) => {
      if (category && p.category !== category) return false
      if (visibility === 'hidden' && !p.hidden) return false
      if (visibility === 'visible' && p.hidden) return false
      if (stock) {
        const info = productStockInfo(p, threshold)
        const level = info.soldOut ? 'out' : info.low > 0 ? 'low' : 'ok'
        if (level !== stock) return false
      }
      if (!q) return true
      return p.name.toLocaleLowerCase('tr-TR').includes(q) || p.number.includes(q) || (p.nameEn ?? '').toLowerCase().includes(q)
    })
  }, [rows, query, category, visibility, stock, threshold])

  function replaceRow(updated: Row) {
    products.setData((list) => (list ?? []).map((p) => (p.id === updated.id ? updated : p)))
  }

  async function savePrice(row: Row, price: number): Promise<boolean> {
    try {
      const updated = await updateAdminProduct(row.id, withExpected(row, { price }))
      replaceRow(updated as Row)
      toast.success(AS.products.priceSaved(row.name, formatPrice(price)))
      return true
    } catch (e) {
      if (isConflict(e)) {
        toast.error(AS.productEdit.conflictTitle)
        products.reload()
      } else toast.error(apiErrorMessage(e))
      return false
    }
  }

  async function bulkSetHidden(hidden: boolean) {
    if (!rows) return
    setBulkPending(true)
    const targets = rows.filter((p) => selected.has(p.id) && !!p.hidden !== hidden)
    const results = await Promise.allSettled(targets.map((p) => updateAdminProduct(p.id, withExpected(p, { hidden }))))
    let ok = 0
    const updatedById: Record<string, Row> = {}
    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        ok++
        updatedById[r.value.id] = r.value as Row
      }
    })
    products.setData((list) => (list ?? []).map((p) => updatedById[p.id] ?? p))
    const fail = targets.length - ok
    if (fail) toast.warning(AS.products.bulkPartial(ok, fail))
    else toast.success(AS.products.bulkDone(Math.max(ok, selected.size), hidden))
    setSelected(new Set())
    setBulkPending(false)
  }

  const columns: Column<Row>[] = [
    {
      key: 'product',
      header: AS.products.colProduct,
      primary: true,
      sortValue: (p) => p.name,
      render: (p) => {
        const src = thumbOf(p)
        return (
          <div className={ui.cellMain}>
            {src ? (
              <img className={ui.thumb} src={src} alt="" loading="lazy" />
            ) : (
              <span className={[ui.thumb, ui.thumbEmpty].join(' ')} title={AS.products.noImage}>
                <AdminIcon name="images" size={18} />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <Link to={`/admin/urunler/${p.id}`} className={ui.cellTitle} style={{ color: 'inherit', textDecoration: 'none' }}>
                {p.name}
              </Link>
              <div className={ui.cellSub}>{AS.products.number(p.number)}</div>
            </div>
          </div>
        )
      },
    },
    { key: 'category', header: AS.products.colCategory, sortValue: (p) => categoryLabel(p.category), render: (p) => categoryLabel(p.category) },
    {
      key: 'price',
      header: AS.products.colPrice,
      align: 'right',
      sortValue: (p) => p.price,
      render: (p) => (useApiMode ? <PriceCell row={p} onSave={savePrice} onZero={(row) => setZeroPrice({ row })} /> : <span className={ui.num}>{formatPrice(p.price)}</span>),
    },
    {
      key: 'stock',
      header: AS.products.colStock,
      sortValue: (p) => productStockInfo(p, threshold).total,
      render: (p) => {
        const info = productStockInfo(p, threshold)
        return (
          <span className={ui.row} style={{ gap: 8, flexWrap: 'nowrap' }}>
            <span className={ui.num}>{info.total}</span>
            {info.soldOut ? (
              <StatusBadge tone="danger">{AS.products.soldOut}</StatusBadge>
            ) : info.low > 0 ? (
              <StatusBadge tone="warning" title={AS.products.lowStockTitle(info.low, threshold)}>
                {AS.products.lowStock}
              </StatusBadge>
            ) : null}
          </span>
        )
      },
    },
    {
      key: 'badge',
      header: AS.products.colBadge,
      sortValue: (p) => (p.newBadge ?? (p.isNew ? 'on' : 'off')),
      render: (p) => {
        const mode = p.newBadge ?? (p.isNew ? 'on' : 'off')
        if (mode === 'on') return <StatusBadge tone="success">{AS.products.badgeOn}</StatusBadge>
        if (mode === 'auto') return <StatusBadge tone={p.isNew ? 'success' : 'neutral'}>{p.isNew ? AS.products.badgeAutoActive : AS.products.badgeAuto}</StatusBadge>
        return <StatusBadge tone="outline" dot={false}>{AS.products.badgeOff}</StatusBadge>
      },
    },
    {
      key: 'status',
      header: AS.products.colStatus,
      sortValue: (p) => (p.hidden ? 1 : 0),
      render: (p) => (p.hidden ? <StatusBadge tone="neutral">{AS.products.hidden}</StatusBadge> : <StatusBadge tone="success">{AS.products.visible}</StatusBadge>),
    },
  ]

  const filtersActive = !!(query || category || stock || visibility)

  return (
    <div>
      <PageHeader
        title={AS.products.title}
        description={AS.products.subtitle}
        actions={
          useApiMode ? (
            <Btn variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {AS.products.add}
            </Btn>
          ) : null
        }
      />
      {useApiMode ? null : <Notice tone="warning">{AS.products.localOnlyActions}</Notice>}

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: AS.products.searchPlaceholder }}
        active={filtersActive}
        onClear={() => {
          setQuery('')
          setCategory('')
          setStock('')
          setVisibility('')
        }}
      >
        <FilterSelect label={AS.products.categoryLabel} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{AS.common.all}</option>
          {editableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={AS.products.stockLabel} value={stock} onChange={(e) => setStock(e.target.value as typeof stock)}>
          <option value="">{AS.products.stockAll}</option>
          <option value="ok">{AS.products.stockOk}</option>
          <option value="low">{AS.products.stockLow}</option>
          <option value="out">{AS.products.stockOut}</option>
        </FilterSelect>
        <FilterSelect label={AS.products.visibilityLabel} value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
          <option value="">{AS.common.all}</option>
          <option value="visible">{AS.products.visibilityVisible}</option>
          <option value="hidden">{AS.products.visibilityHidden}</option>
        </FilterSelect>
      </FilterBar>

      {products.error && !products.data ? (
        <ErrorState message={apiErrorMessage(products.error)} onRetry={products.reload} />
      ) : (
        <DataTable
          caption={AS.products.title}
          columns={columns}
          rows={filtered}
          rowKey={(p) => p.id}
          resetKey={`${query}|${category}|${stock}|${visibility}`}
          onRowClick={(p) => navigate(`/admin/urunler/${p.id}`)}
          rowLabel={(p) => AS.products.editAria(p.name)}
          selection={useApiMode ? { selected, onChange: setSelected, label: (p) => p.name } : undefined}
          bulkActions={
            <>
              <Btn size="sm" icon="eye-off" loading={bulkPending} onClick={() => void bulkSetHidden(true)}>
                {AS.products.bulkHide}
              </Btn>
              <Btn size="sm" icon="eye" disabled={bulkPending} onClick={() => void bulkSetHidden(false)}>
                {AS.products.bulkShow}
              </Btn>
            </>
          }
          rowActions={(p) => <Btn size="sm" variant="ghost" icon="edit" iconOnly label={AS.products.editAria(p.name)} to={`/admin/urunler/${p.id}`} />}
          empty={<EmptyState icon="products" title={filtersActive ? AS.products.empty : AS.products.emptyAll} />}
        />
      )}

      {useApiMode ? (
        <CreateProductDialog
          open={creating}
          onClose={() => {
            setCreating(false)
            if (params.get('yeni')) setParams({}, { replace: true })
          }}
          onCreated={(id) => {
            toast.success(AS.products.created)
            navigate(`/admin/urunler/${id}`)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={zeroPrice != null}
        title={AS.productEdit.priceZeroTitle}
        message={AS.productEdit.priceZeroText}
        confirmLabel={AS.productEdit.priceZeroConfirm}
        onCancel={() => setZeroPrice(null)}
        onConfirm={() => {
          const row = zeroPrice?.row
          setZeroPrice(null)
          if (row) void savePrice(row, 0)
        }}
      />
    </div>
  )
}

/** Satır içi fiyat: tıkla → yaz → Enter kaydeder, Esc vazgeçer. 0 için onay istenir. */
function PriceCell({ row, onSave, onZero }: { row: Row; onSave: (row: Row, price: number) => Promise<boolean>; onZero: (row: Row) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  function start() {
    setValue(String(row.price).replace('.', ','))
    setError(false)
    setEditing(true)
  }

  async function commit() {
    const n = parseAmount(value)
    if (n == null || n < 0) {
      setError(true)
      return
    }
    if (n === row.price) {
      setEditing(false)
      return
    }
    if (n === 0) {
      setEditing(false)
      onZero(row)
      return
    }
    setSaving(true)
    const ok = await onSave(row, n)
    setSaving(false)
    if (ok) {
      setEditing(false)
      requestAnimationFrame(() => btnRef.current?.focus())
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setEditing(false)
      requestAnimationFrame(() => btnRef.current?.focus())
    }
  }

  if (editing) {
    return (
      <span className={ui.row} style={{ justifyContent: 'flex-end', flexWrap: 'nowrap', gap: 6 }}>
        <input
          autoFocus
          className={[ui.control, styles.priceInput].join(' ')}
          inputMode="decimal"
          value={value}
          disabled={saving}
          aria-invalid={error || undefined}
          aria-label={AS.products.priceInputAria(row.name)}
          title={error ? AS.products.priceInvalid : undefined}
          onChange={(e) => {
            setValue(e.target.value)
            setError(false)
          }}
          onKeyDown={onKey}
          onBlur={() => {
            if (!saving) setEditing(false)
          }}
        />
        {saving ? <span className={ui.spinner} aria-hidden="true" /> : null}
      </span>
    )
  }
  return (
    <button ref={btnRef} type="button" className={styles.priceBtn} onClick={start} aria-label={AS.products.priceAria(row.name)}>
      {formatPrice(row.price)}
    </button>
  )
}

function CreateProductDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [cat, setCat] = useState<string>(editableCategories[0]?.id ?? '')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [priceError, setPriceError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const toast = useToast()

  async function submit() {
    const p = price.trim() ? parseAmount(price) : 0
    if (p == null || p < 0) {
      setPriceError(AS.productEdit.priceInvalid)
      return
    }
    setPending(true)
    try {
      // Yeni ürün admin doldurana kadar mağazada GİZLİ kalır — aksi halde 0 TL fiyatlı, adı/görseli
      // olmayan bir ürün anında müşterilere görünür olurdu.
      const product = await createAdminProduct({
        category: cat as Product['category'],
        price: p,
        hidden: true,
        ...(name.trim() ? { name: name.trim().slice(0, 200) } : {}),
      })
      onCreated(product.id)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <ConfirmDialog open={open} title={AS.products.addTitle} message={AS.products.addText} confirmLabel={AS.products.addSubmit} pending={pending} onCancel={onClose} onConfirm={() => void submit()}>
      <form
        className={ui.stack}
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <SelectField label={AS.products.addCategory} value={cat} onChange={(e) => setCat(e.target.value)}>
          {editableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <TextField label={AS.products.addName} optional maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label={AS.products.addPrice}
          optional
          inputMode="decimal"
          suffix="TL"
          value={price}
          error={priceError}
          onChange={(e) => {
            setPrice(e.target.value)
            setPriceError(null)
          }}
        />
        <button type="submit" hidden />
      </form>
    </ConfirmDialog>
  )
}
