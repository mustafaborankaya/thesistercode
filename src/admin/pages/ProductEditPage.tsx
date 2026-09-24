import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, SelectField, Switch, TextareaField } from '../../components/ui/Field'
import { allProducts, allSizes, baseSeeds, categories, colorOptions } from '../../data/catalog'
import { productMediaName } from '../../data/media'
import type { Product, SizeId } from '../../data/types'
import { updateAdminData, type ProductOverride } from '../adminStore'
import { AS } from '../adminStrings'
import { MediaField } from '../components/MediaField'
import { SaveBar } from '../components/SaveBar'
import styles from '../admin.module.css'

type Seed = (typeof baseSeeds)[number]
type CategoryValue = Product['category']

const editableCategories = categories.filter((c) => !c.virtual)

interface FormState {
  name: string
  price: string
  category: CategoryValue
  isNew: boolean
  hidden: boolean
  colors: string[]
  stock: Record<string, Record<SizeId, string>>
  description: string
  fabricCare: string
  deliveryReturns: string
  similarProductIds: string[]
  completeLookProductIds: string[]
}

function seedStockDefault(seed: Seed, colorId: string, size: SizeId): number {
  return seed.stockByColor?.[colorId]?.[size] ?? seed.stock?.[size] ?? 4
}

function defaultTexts(number: string) {
  return {
    name: `Ürün ${number} — Ürün adı`,
    description: `Ürün ${number} — Ürün açıklaması alanı`,
    fabricCare: `Ürün ${number} — Kumaş ve bakım bilgisi alanı`,
    deliveryReturns: 'Teslimat ve iade bilgisi alanı',
  }
}

function buildFormFromProduct(product: Product): FormState {
  const stock: FormState['stock'] = {}
  for (const color of product.colors) {
    const row = {} as Record<SizeId, string>
    for (const size of allSizes) row[size] = String(product.stock[color.id]?.[size] ?? 0)
    stock[color.id] = row
  }
  return {
    name: product.name,
    price: String(product.price),
    category: product.category,
    isNew: product.isNew,
    hidden: product.hidden ?? false,
    colors: product.colors.map((c) => c.id),
    stock,
    description: product.content.description,
    fabricCare: product.content.fabricCare,
    deliveryReturns: product.content.deliveryReturns,
    similarProductIds: product.similarProductIds ?? [],
    completeLookProductIds: product.completeLookProductIds ?? [],
  }
}

function buildFormFromSeed(seed: Seed, number: string): FormState {
  const colors = seed.colors ?? ['renk-1']
  const stock: FormState['stock'] = {}
  for (const colorId of colors) {
    const row = {} as Record<SizeId, string>
    for (const size of allSizes) row[size] = String(seedStockDefault(seed, colorId, size))
    stock[colorId] = row
  }
  const texts = defaultTexts(number)
  return {
    name: texts.name,
    price: String(seed.price),
    category: seed.category,
    isNew: seed.isNew ?? false,
    hidden: false,
    colors,
    stock,
    description: texts.description,
    fabricCare: texts.fabricCare,
    deliveryReturns: texts.deliveryReturns,
    similarProductIds: seed.similarProductIds ?? [],
    completeLookProductIds: seed.completeLookProductIds ?? [],
  }
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

/** `/admin/urunler/:id` — tek ürün düzenleme formu. */
export function ProductEditPage() {
  const { id = '' } = useParams()
  const product = allProducts.find((p) => p.id === id)
  const seed = baseSeeds.find((s) => s.id === id)

  const [form, setForm] = useState<FormState | null>(() => (product ? buildFormFromProduct(product) : null))
  const [message, setMessage] = useState<string | null>(null)

  if (!product || !seed || !form) {
    return (
      <div>
        <p className={styles.empty}>{AS.productEdit.notFound}</p>
        <p style={{ marginTop: 'var(--sp-4)' }}>
          <Link className="link" to="/admin/urunler">
            {AS.productEdit.backToList}
          </Link>
        </p>
      </div>
    )
  }

  const texts = defaultTexts(product.number)
  // Nested function/closure narrowing doesn't persist for `product`/`seed`/`form` after the guard
  // above, so capture non-null locals here and use these inside handleSave/handleReset/toggleColor.
  const currentProduct = product
  const currentSeed = seed
  const currentForm = form

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    setMessage(null)
  }

  function toggleColor(colorId: string, checked: boolean) {
    setForm((f) => {
      if (!f) return f
      let nextColors = checked ? [...f.colors, colorId] : f.colors.filter((c) => c !== colorId)
      if (nextColors.length === 0) nextColors = f.colors
      const stock = { ...f.stock }
      if (checked && !stock[colorId]) {
        const row = {} as Record<SizeId, string>
        for (const size of allSizes) row[size] = String(seedStockDefault(currentSeed, colorId, size))
        stock[colorId] = row
      }
      return { ...f, colors: nextColors, stock }
    })
    setMessage(null)
  }

  function updateStock(colorId: string, size: SizeId, value: string) {
    setForm((f) => (f ? { ...f, stock: { ...f.stock, [colorId]: { ...f.stock[colorId], [size]: value } } } : f))
    setMessage(null)
  }

  function toggleRelated(field: 'similarProductIds' | 'completeLookProductIds', otherId: string, checked: boolean) {
    setForm((f) => {
      if (!f) return f
      const list = checked ? [...f[field], otherId] : f[field].filter((v) => v !== otherId)
      return { ...f, [field]: list }
    })
    setMessage(null)
  }

  function handleSave() {
    const override: ProductOverride = {}
    const f = currentForm
    const sd = currentSeed

    const trimmedName = f.name.trim()
    if (trimmedName && trimmedName !== texts.name) override.name = trimmedName

    const trimmedPrice = f.price.trim()
    const priceNum = Number(trimmedPrice)
    if (trimmedPrice && Number.isFinite(priceNum) && priceNum >= 0 && priceNum !== sd.price) override.price = priceNum

    if (f.category !== sd.category) override.category = f.category

    const defaultIsNew = sd.isNew ?? false
    if (f.isNew !== defaultIsNew) override.isNew = f.isNew

    if (f.hidden) override.hidden = true

    const defaultColors = sd.colors ?? ['renk-1']
    if (!sameSet(f.colors, defaultColors)) override.colors = f.colors

    const stockOverride: Record<string, Partial<Record<SizeId, number>>> = {}
    for (const colorId of f.colors) {
      const row = f.stock[colorId]
      if (!row) continue
      const cellOverride: Partial<Record<SizeId, number>> = {}
      for (const size of allSizes) {
        const value = Number(row[size])
        const def = seedStockDefault(sd, colorId, size)
        if (Number.isFinite(value) && value !== def) cellOverride[size] = value
      }
      if (Object.keys(cellOverride).length > 0) stockOverride[colorId] = cellOverride
    }
    if (Object.keys(stockOverride).length > 0) override.stock = stockOverride

    const trimmedDescription = f.description.trim()
    if (trimmedDescription && trimmedDescription !== texts.description) override.description = trimmedDescription

    const trimmedFabricCare = f.fabricCare.trim()
    if (trimmedFabricCare && trimmedFabricCare !== texts.fabricCare) override.fabricCare = trimmedFabricCare

    const trimmedDeliveryReturns = f.deliveryReturns.trim()
    if (trimmedDeliveryReturns && trimmedDeliveryReturns !== texts.deliveryReturns) override.deliveryReturns = trimmedDeliveryReturns

    const defaultSimilar = sd.similarProductIds ?? []
    if (!sameSet(f.similarProductIds, defaultSimilar)) override.similarProductIds = f.similarProductIds

    const defaultCompleteLook = sd.completeLookProductIds ?? []
    if (!sameSet(f.completeLookProductIds, defaultCompleteLook)) override.completeLookProductIds = f.completeLookProductIds

    const productId = currentProduct.id
    updateAdminData((current) => {
      const products = { ...current.products }
      if (Object.keys(override).length === 0) delete products[productId]
      else products[productId] = override
      return { ...current, products }
    })
    setMessage(AS.save.saved)
  }

  function handleReset() {
    const productId = currentProduct.id
    const productNumber = currentProduct.number
    const sd = currentSeed
    updateAdminData((current) => {
      const products = { ...current.products }
      delete products[productId]
      return { ...current, products }
    })
    setForm(buildFormFromSeed(sd, productNumber))
    setMessage(AS.productEdit.resetDone)
  }

  const otherProducts = allProducts.filter((p) => p.id !== product.id)

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.productEdit.title(product.number)}</h1>
      </div>
      <p className={styles.demoNotice}>{AS.demoNotice}</p>

      <div className={styles.section}>
        <div className={styles.grid}>
          <Field label={AS.productEdit.nameLabel} value={form.name} onChange={(e) => update('name', e.target.value)} />
          <Field label={AS.productEdit.priceLabel} type="number" min={0} value={form.price} onChange={(e) => update('price', e.target.value)} />
          <SelectField label={AS.productEdit.categoryLabel} value={form.category} onChange={(e) => update('category', e.target.value as CategoryValue)}>
            {editableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </SelectField>
          <div className={styles.fieldStack}>
            <Switch label={AS.productEdit.isNewLabel} checked={form.isNew} onChange={(e) => update('isNew', e.target.checked)} />
            <Switch label={AS.productEdit.hiddenLabel} checked={form.hidden} onChange={(e) => update('hidden', e.target.checked)} />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.productEdit.colorsTitle}</div>
        <div className={styles.checkList} style={{ maxHeight: 'none' }}>
          {colorOptions.map((opt) => (
            <Checkbox key={opt.id} label={opt.label} checked={form.colors.includes(opt.id)} onChange={(e) => toggleColor(opt.id, e.target.checked)} />
          ))}
        </div>
        <p className="text-soft text-xs" style={{ marginTop: 'var(--sp-2)' }}>
          {AS.productEdit.colorsHint}
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.productEdit.stockTitle}</div>
        <div className={styles.stockTableWrap}>
          <table className={styles.stockTable}>
            <thead>
              <tr>
                <th scope="col">{AS.productEdit.colorsTitle}</th>
                {allSizes.map((size) => (
                  <th key={size} scope="col">
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.colors.map((colorId) => {
                const label = colorOptions.find((c) => c.id === colorId)?.label ?? colorId
                return (
                  <tr key={colorId}>
                    <th scope="row">{label}</th>
                    {allSizes.map((size) => (
                      <td key={size}>
                        <label className="sr-only" htmlFor={`stock-${colorId}-${size}`}>
                          {label} {size}
                        </label>
                        <input
                          id={`stock-${colorId}-${size}`}
                          type="number"
                          min={0}
                          value={form.stock[colorId]?.[size] ?? '0'}
                          onChange={(e) => updateStock(colorId, size, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.productEdit.contentTitle}</div>
        <div className={styles.fieldStack}>
          <TextareaField label={AS.productEdit.descriptionLabel} rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} />
          <TextareaField label={AS.productEdit.fabricCareLabel} rows={3} value={form.fabricCare} onChange={(e) => update('fabricCare', e.target.value)} />
          <TextareaField label={AS.productEdit.deliveryReturnsLabel} rows={3} value={form.deliveryReturns} onChange={(e) => update('deliveryReturns', e.target.value)} />
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{AS.productEdit.similarTitle}</div>
          <div className={styles.checkList}>
            {otherProducts.map((p) => (
              <Checkbox
                key={p.id}
                label={`${p.number} — ${p.name}`}
                checked={form.similarProductIds.includes(p.id)}
                onChange={(e) => toggleRelated('similarProductIds', p.id, e.target.checked)}
              />
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{AS.productEdit.completeLookTitle}</div>
          <div className={styles.checkList}>
            {otherProducts.map((p) => (
              <Checkbox
                key={p.id}
                label={`${p.number} — ${p.name}`}
                checked={form.completeLookProductIds.includes(p.id)}
                onChange={(e) => toggleRelated('completeLookProductIds', p.id, e.target.checked)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.productEdit.mediaTitle}</div>
        <div className={styles.mediaGrid}>
          <MediaField name={productMediaName(product.number, 'front')} label={AS.productEdit.frontLabel} onChange={() => setMessage(AS.save.saved)} />
          <MediaField name={productMediaName(product.number, 'back')} label={AS.productEdit.backLabel} onChange={() => setMessage(AS.save.saved)} />
          <MediaField name={productMediaName(product.number, 'model')} label={AS.productEdit.modelLabel} onChange={() => setMessage(AS.save.saved)} />
          <MediaField name={productMediaName(product.number, 'fabric')} label={AS.productEdit.fabricLabel} onChange={() => setMessage(AS.save.saved)} />
        </div>
      </div>

      <SaveBar onSave={handleSave} message={message}>
        <Button variant="ghost" onClick={handleReset}>
          {AS.productEdit.resetToDefault}
        </Button>
        <Button variant="secondary" to="/admin/urunler">
          {AS.productEdit.backToList}
        </Button>
      </SaveBar>
    </div>
  )
}
