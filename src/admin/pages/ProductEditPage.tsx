import { useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { allProducts, allSizes, baseSeeds, categories, colorOptions } from '../../data/catalog'
import { mediaByName, productMediaName } from '../../data/media'
import type { MediaKind, Product, SizeId } from '../../data/types'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { ApiError } from '../../services/api'
import { getAdminSettings, listAdminProducts, updateAdminProduct, useApiMode, type AdminProduct, type AdminProductPatch, type NewBadgeMode } from '../adminApi'
import { readAdminData, updateAdminData, type ProductOverride } from '../adminStore'
import { AS } from '../adminStrings'
import { ApiMediaField } from '../components/ApiMediaField'
import { MediaField } from '../components/MediaField'
import { inventoryConfigFrom, localInventoryConfig, MAX_STOCK_QTY, stockLevel, type InventoryConfig } from '../inventory'
import { isConflict, withExpected } from '../productUtils'
import { Btn } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { CheckField, Segmented, SelectField, SwitchField, TextAreaField, TextField } from '../ui/Form'
import { FormSection } from '../ui/FormSection'
import { EmptyState, ErrorState, Notice, PageHeader } from '../ui/Page'
import { StatusBadge } from '../ui/StatusBadge'
import { StickySaveBar } from '../ui/StickySaveBar'
import { Tabs } from '../ui/Tabs'
import { tabPanelProps } from '../ui/tabPanel'
import { parseAmount } from '../ui/format'
import { useToast } from '../ui/toastContext'
import { useLoader } from '../ui/useLoader'
import ui from '../ui/ui.module.css'
import styles from '../admin.module.css'

type Seed = (typeof baseSeeds)[number]
type CategoryValue = Product['category']
type AnyProduct = (Product | AdminProduct) & { updatedAt?: string | null }

const editableCategories = categories.filter((c) => !c.virtual)
const MEDIA_KINDS: { kind: MediaKind; label: string }[] = [
  { kind: 'front', label: AS.productEdit.frontLabel },
  { kind: 'back', label: AS.productEdit.backLabel },
  { kind: 'model', label: AS.productEdit.modelLabel },
  { kind: 'fabric', label: AS.productEdit.fabricLabel },
]

interface FormState {
  name: string
  price: string
  category: CategoryValue
  isNew: boolean
  /** "Yeni" rozeti modu (yalnızca API modunda düzenlenir; yerelde `isNew` anahtarı kullanılır). */
  newBadge: NewBadgeMode
  hidden: boolean
  colors: string[]
  /** Renk id → Türkçe renk adı (yalnızca API modunda düzenlenir). */
  colorLabels: Record<string, string>
  stock: Record<string, Record<SizeId, string>>
  description: string
  fabricCare: string
  deliveryReturns: string
  similarProductIds: string[]
  completeLookProductIds: string[]
  /** İngilizce alanlar (`/en` sitesi) — boş → mağaza Türkçeye düşer. */
  nameEn: string
  descriptionEn: string
  fabricCareEn: string
  /** Renk id → İngilizce renk adı (yalnızca API modunda düzenlenir). */
  colorLabelsEn: Record<string, string>
}

type TabId = 'general' | 'pricing' | 'media' | 'english' | 'related'
type Errors = Partial<Record<'name' | 'price' | 'stock' | 'colorLabels', string>>

const TAB_FIELDS: Record<TabId, (keyof FormState)[]> = {
  general: ['name', 'category', 'isNew', 'newBadge', 'hidden', 'description', 'fabricCare', 'deliveryReturns'],
  pricing: ['price', 'colors', 'colorLabels', 'stock'],
  media: [],
  english: ['nameEn', 'descriptionEn', 'fabricCareEn', 'colorLabelsEn'],
  related: ['similarProductIds', 'completeLookProductIds'],
}
const ERROR_TAB: Record<keyof Errors, TabId> = { name: 'general', price: 'pricing', stock: 'pricing', colorLabels: 'pricing' }

/** EN alanlarını ürün nesnesinden okur: API ürünü (AdminProduct) EN alanları taşır, yerel demo ürünü taşımaz. */
function enFieldsOf(product: AnyProduct): Pick<FormState, 'nameEn' | 'descriptionEn' | 'fabricCareEn' | 'colorLabelsEn'> {
  const p = product as Partial<AdminProduct>
  return {
    nameEn: p.nameEn ?? '',
    descriptionEn: p.content?.descriptionEn ?? '',
    fabricCareEn: p.content?.fabricCareEn ?? '',
    colorLabelsEn: Object.fromEntries((p.colors ?? []).map((c) => [c.id, c.labelEn ?? ''])),
  }
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

const colorOptionLabel = (id: string) => colorOptions.find((c) => c.id === id)?.label ?? id

function buildFormFromProduct(product: AnyProduct): FormState {
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
    newBadge: (product as Partial<AdminProduct>).newBadge ?? (product.isNew ? 'on' : 'off'),
    hidden: product.hidden ?? false,
    colors: product.colors.map((c) => c.id),
    colorLabels: Object.fromEntries(product.colors.map((c) => [c.id, c.label])),
    stock,
    description: product.content.description,
    fabricCare: product.content.fabricCare,
    deliveryReturns: product.content.deliveryReturns,
    similarProductIds: product.similarProductIds ?? [],
    completeLookProductIds: product.completeLookProductIds ?? [],
    ...enFieldsOf(product),
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
    newBadge: seed.isNew ? 'on' : 'off',
    hidden: false,
    colors,
    colorLabels: Object.fromEntries(colors.map((c) => [c, colorOptionLabel(c)])),
    stock,
    description: texts.description,
    fabricCare: texts.fabricCare,
    deliveryReturns: texts.deliveryReturns,
    similarProductIds: seed.similarProductIds ?? [],
    completeLookProductIds: seed.completeLookProductIds ?? [],
    nameEn: '',
    descriptionEn: '',
    fabricCareEn: '',
    colorLabelsEn: {},
  }
}

/** EN değeri karşılaştırması: boş → null (sunucuda EN temizlenir). Değişmediyse undefined. */
function enDiff(value: string, original: string | null | undefined): string | null | undefined {
  const trimmed = value.trim()
  if (trimmed === (original ?? '').trim()) return undefined
  return trimmed ? trimmed : null
}

/** Stok hücresi geçerli mi: boşluksuz 0..9999 tam sayı (ondalık/negatif/boş → geçersiz). */
function validStockValue(value: string): boolean {
  const t = value.trim()
  return /^\d+$/.test(t) && Number(t) <= MAX_STOCK_QTY
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

/** Ortak doğrulama: ad (boş/200+), fiyat (sayı ≥ 0), stok hücreleri, renk adları. */
function validate(form: FormState, apiMode: boolean): { errors: Errors; price: number | null } {
  const errors: Errors = {}
  const name = form.name.trim()
  if (!name) errors.name = AS.productEdit.nameRequired
  else if (name.length > 200) errors.name = AS.productEdit.nameTooLong
  const price = parseAmount(form.price)
  if (price == null || price < 0) errors.price = AS.productEdit.priceInvalid
  if (!form.colors.every((cid) => allSizes.every((size) => validStockValue(form.stock[cid]?.[size] ?? '0')))) errors.stock = AS.productEdit.stockInvalid
  if (apiMode && form.colors.some((cid) => !(form.colorLabels[cid] ?? '').trim())) errors.colorLabels = AS.productEdit.colorLabelRequired
  return { errors, price: errors.price ? null : price }
}

function changedKeys(a: FormState, b: FormState): Set<keyof FormState> {
  const out = new Set<keyof FormState>()
  for (const k of Object.keys(a) as (keyof FormState)[]) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.add(k)
  return out
}

/** API PUT gövdesi: yalnızca değişen alanlar (bkz. api/src/routes/admin-products.js → updateSchema). */
function buildApiPatch(form: FormState, product: AdminProduct, price: number): AdminProductPatch {
  const patch: AdminProductPatch = {}
  const trimmedName = form.name.trim()
  if (trimmedName !== product.name) patch.name = trimmedName
  if (price !== product.price) patch.price = price
  if (form.category !== product.category) patch.category = form.category
  if (form.newBadge !== (product.newBadge ?? (product.isNew ? 'on' : 'off'))) patch.newBadge = form.newBadge
  if (form.hidden !== (product.hidden ?? false)) patch.hidden = form.hidden

  const nameEn = enDiff(form.nameEn, product.nameEn)
  if (nameEn !== undefined) patch.nameEn = nameEn
  const descriptionEn = enDiff(form.descriptionEn, product.content.descriptionEn)
  if (descriptionEn !== undefined) patch.descriptionEn = descriptionEn
  const fabricCareEn = enDiff(form.fabricCareEn, product.content.fabricCareEn)
  if (fabricCareEn !== undefined) patch.fabricCareEn = fabricCareEn

  // Renkler: set, TR adı ya da EN adı değiştiyse tam liste gönderilir (sunucu renkleri sil-yeniden-ekle ile yazar).
  const currentColorIds = product.colors.map((c) => c.id)
  const labelChanged = form.colors.some((cid) => (form.colorLabels[cid] ?? '').trim() !== (product.colors.find((c) => c.id === cid)?.label ?? ''))
  const colorEnChanged = form.colors.some((cid) => enDiff(form.colorLabelsEn[cid] ?? '', product.colors.find((c) => c.id === cid)?.labelEn) !== undefined)
  if (!sameSet(form.colors, currentColorIds) || labelChanged || colorEnChanged) {
    patch.colors = form.colors.map((cid) => ({
      id: cid,
      label: (form.colorLabels[cid] ?? '').trim() || product.colors.find((c) => c.id === cid)?.label || colorOptionLabel(cid),
      labelEn: (form.colorLabelsEn[cid] ?? '').trim() || null,
    }))
  }

  // Stok: değişen hücreler; YENİ eklenen rengin tüm hücreleri (0 olsa da) her zaman gönderilir.
  const stockPatch: Record<string, Partial<Record<SizeId, number>>> = {}
  for (const colorId of form.colors) {
    const row = form.stock[colorId]
    if (!row) continue
    const isNewColor = !currentColorIds.includes(colorId)
    const cell: Partial<Record<SizeId, number>> = {}
    for (const size of allSizes) {
      const value = Number(row[size])
      const original = product.stock[colorId]?.[size] ?? 0
      if (Number.isFinite(value) && (isNewColor || value !== original)) cell[size] = value
    }
    if (Object.keys(cell).length) stockPatch[colorId] = cell
  }
  if (Object.keys(stockPatch).length) patch.stock = stockPatch

  const d = form.description.trim()
  if (d !== product.content.description) patch.description = d
  const fc = form.fabricCare.trim()
  if (fc !== product.content.fabricCare) patch.fabricCare = fc
  const dr = form.deliveryReturns.trim()
  if (dr !== product.content.deliveryReturns) patch.deliveryReturns = dr

  if (!sameSet(form.similarProductIds, product.similarProductIds ?? [])) patch.similarProductIds = form.similarProductIds
  if (!sameSet(form.completeLookProductIds, product.completeLookProductIds ?? [])) patch.completeLookProductIds = form.completeLookProductIds
  return patch
}

/** `/admin/urunler/:id` — sekmeli ürün düzenleme. API varsa sunucudan okur/yazar; yoksa (yerel geliştirme) localStorage override'ı. */
export function ProductEditPage() {
  const { id = '' } = useParams()
  return useApiMode ? <ApiProductEditPage key={id} id={id} /> : <LocalProductEditPage key={id} id={id} />
}

/* ==================== API modu ==================== */

function ApiProductEditPage({ id }: { id: string }) {
  const toast = useToast()
  const list = useLoader(listAdminProducts)
  const config = useLoader<InventoryConfig>(() => getAdminSettings().then(inventoryConfigFrom))
  const cfg = config.data ?? localInventoryConfig()
  const product = (list.data?.find((p) => p.id === id) ?? null) as (AdminProduct & { updatedAt?: string | null }) | null

  const [form, setForm] = useState<FormState | null>(null)
  const [baseline, setBaseline] = useState<FormState | null>(null)
  const [forProduct, setForProduct] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [tab, setTab] = useState<TabId>('general')
  const [pending, setPending] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [confirmZero, setConfirmZero] = useState(false)
  const [removeKind, setRemoveKind] = useState<MediaKind | null>(null)
  const [removing, setRemoving] = useState(false)

  // Ürün ilk kez yüklenince (ya da "Yenile" sonrası) formu kur — render sırasında, efektsiz.
  const productStamp = product ? `${product.id}@${product.updatedAt ?? ''}#${list.data?.length}` : null
  if (product && forProduct === null) {
    const f = buildFormFromProduct(product)
    setForm(f)
    setBaseline(f)
    setForProduct(productStamp)
  }

  if (list.error && !list.data) return <ErrorState message={apiErrorMessage(list.error)} onRetry={list.reload} />
  if (!list.data) return <LoadingState />
  if (!product || !form || !baseline) return <NotFound />

  const changed = changedKeys(form, baseline)
  const dirty = changed.size > 0

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    // Kullanıcı hatalı alanı düzelttiğinde o alanın hatası hemen kalkar.
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function reloadFromServer() {
    setConflict(false)
    setForProduct(null)
    setErrors({})
    list.reload()
  }

  async function save(allowZero = false) {
    if (!form || !product) return
    const { errors: errs, price } = validate(form, true)
    setErrors(errs)
    const firstErr = (Object.keys(errs) as (keyof Errors)[])[0]
    if (firstErr || price == null) {
      if (firstErr) setTab(ERROR_TAB[firstErr])
      toast.error(AS.apiNotice.validation)
      return
    }
    if (price === 0 && product.price !== 0 && !allowZero) {
      setConfirmZero(true)
      return
    }
    const patch = buildApiPatch(form, product, price)
    if (Object.keys(patch).length === 0) {
      setBaseline(form)
      toast.info(AS.save.nothing)
      return
    }
    setPending(true)
    try {
      const updated = await updateAdminProduct(product.id, withExpected(product, patch))
      list.setData((l) => (l ?? []).map((p) => (p.id === updated.id ? updated : p)))
      const fresh = buildFormFromProduct(updated)
      setForm(fresh)
      setBaseline(fresh)
      toast.success(AS.apiNotice.saved)
    } catch (e) {
      if (isConflict(e)) setConflict(true)
      else toast.error(e instanceof ApiError && e.code === 'validation_error' ? `${AS.apiNotice.validation} (${apiErrorMessage(e)})` : apiErrorMessage(e))
    } finally {
      setPending(false)
    }
  }

  async function uploadMedia(kind: MediaKind, url: string) {
    const updated = await updateAdminProduct(product!.id, { media: { [kind]: url } })
    list.setData((l) => (l ?? []).map((p) => (p.id === updated.id ? updated : p)))
  }

  async function confirmRemoveMedia() {
    if (!removeKind || !product) return
    setRemoving(true)
    try {
      // Yeni sunucu: yuvaya null → görsel kaldırılır. Eski sunucu 400 döner → bilgilendir.
      const updated = await updateAdminProduct(product.id, { media: { [removeKind]: null } })
      list.setData((l) => (l ?? []).map((p) => (p.id === updated.id ? updated : p)))
      toast.success(AS.productEdit.mediaRemoved)
      setRemoveKind(null)
    } catch (e) {
      toast.error(e instanceof ApiError && (e.status === 400 || e.status === 404) ? AS.productEdit.mediaRemoveUnsupported : apiErrorMessage(e))
      setRemoveKind(null)
    } finally {
      setRemoving(false)
    }
  }

  const mediaByKind = Object.fromEntries(product.media.map((m) => [m.kind, m]))
  const others = (list.data ?? []).filter((p) => p.id !== product.id)

  return (
    <>
      <EditHeader product={product} form={form} />
      {conflict ? (
        <Notice
          tone="danger"
          action={
            <Btn icon="refresh" onClick={reloadFromServer}>
              {AS.productEdit.conflictReload}
            </Btn>
          }
        >
          <strong>{AS.productEdit.conflictTitle}</strong>
          <div>{AS.productEdit.conflictText}</div>
        </Notice>
      ) : null}
      <ProductFormView
        mode="api"
        tab={tab}
        onTab={setTab}
        form={form}
        changed={changed}
        errors={errors}
        update={update}
        setForm={setForm}
        config={cfg}
        others={others}
        currentBadgeActive={product.isNew}
        savedBadgeMode={product.newBadge ?? (product.isNew ? 'on' : 'off')}
        productColorLabel={(cid) => product.colors.find((c) => c.id === cid)?.label ?? colorOptionLabel(cid)}
        media={
          <>
            <Notice tone="neutral">{AS.productEdit.mediaHint}</Notice>
            <div className={ui.slotGrid}>
              {MEDIA_KINDS.map(({ kind, label }) => {
                const serverSrc = mediaByKind[kind]?.src ?? null
                // Sunucuda URL yoksa mağaza paketlenmiş dosyayı gösterir; panel de onu gösterir ama kaldırılamaz.
                const fallback = serverSrc ? null : mediaByName(productMediaName(product.number, kind))
                return (
                  <ApiMediaField
                    key={kind}
                    name={productMediaName(product.number, kind)}
                    label={label}
                    src={serverSrc ?? fallback}
                    meta={fallback ? AS.productEdit.mediaDefault : undefined}
                    savedMessage={AS.productEdit.mediaSaved}
                    pendingExternal={removing && removeKind === kind}
                    onUpload={(url) => uploadMedia(kind, url)}
                    onRequestRemove={serverSrc ? () => setRemoveKind(kind) : undefined}
                  />
                )
              })}
            </div>
          </>
        }
      />
      <StickySaveBar
        dirty={dirty && !conflict}
        saving={pending}
        changes={changed.size}
        onSave={() => void save()}
        onDiscard={() => {
          setForm(baseline)
          setErrors({})
          toast.info(AS.save.discarded)
        }}
      />
      <ConfirmDialog
        open={confirmZero}
        title={AS.productEdit.priceZeroTitle}
        message={AS.productEdit.priceZeroText}
        confirmLabel={AS.productEdit.priceZeroConfirm}
        onCancel={() => setConfirmZero(false)}
        onConfirm={() => {
          setConfirmZero(false)
          void save(true)
        }}
      />
      <ConfirmDialog
        open={removeKind != null}
        title={removeKind ? AS.mediaPage.removeTitle(MEDIA_KINDS.find((m) => m.kind === removeKind)!.label) : ''}
        message={AS.mediaPage.removeText}
        confirmLabel={AS.mediaPage.removeConfirm}
        tone="danger"
        pending={removing}
        onCancel={() => setRemoveKind(null)}
        onConfirm={() => void confirmRemoveMedia()}
      />
    </>
  )
}

/* ==================== Yerel (localStorage) modu — yalnızca API yokken (DEV) ==================== */

function LocalProductEditPage({ id }: { id: string }) {
  const toast = useToast()
  const product = allProducts.find((p) => p.id === id)
  const seed = baseSeeds.find((s) => s.id === id)
  const initial = useMemo<FormState | null>(() => {
    if (!product) return null
    const o = readAdminData().products[product.id] ?? {}
    return { ...buildFormFromProduct(product), nameEn: o.nameEn ?? '', descriptionEn: o.descriptionEn ?? '', fabricCareEn: o.fabricCareEn ?? '' }
  }, [product])
  const [form, setForm] = useState<FormState | null>(initial)
  const [baseline, setBaseline] = useState<FormState | null>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [tab, setTab] = useState<TabId>('general')
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmZero, setConfirmZero] = useState(false)

  if (!product || !seed || !form || !baseline) return <NotFound />
  const currentProduct = product
  const sd = seed
  const texts = defaultTexts(product.number)
  const changed = changedKeys(form, baseline)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    // Kullanıcı hatalı alanı düzelttiğinde o alanın hatası hemen kalkar.
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function save(allowZero = false) {
    if (!form) return
    const { errors: errs, price } = validate(form, false)
    setErrors(errs)
    const firstErr = (Object.keys(errs) as (keyof Errors)[])[0]
    if (firstErr || price == null) {
      if (firstErr) setTab(ERROR_TAB[firstErr])
      toast.error(AS.apiNotice.validation)
      return
    }
    if (price === 0 && sd.price !== 0 && !allowZero) {
      setConfirmZero(true)
      return
    }
    const f = form
    const override: ProductOverride = {}
    const trimmedName = f.name.trim()
    if (trimmedName !== texts.name) override.name = trimmedName
    if (price !== sd.price) override.price = price
    if (f.category !== sd.category) override.category = f.category
    if (f.isNew !== (sd.isNew ?? false)) override.isNew = f.isNew
    if (f.hidden) override.hidden = true
    if (!sameSet(f.colors, sd.colors ?? ['renk-1'])) override.colors = f.colors
    const stockOverride: Record<string, Partial<Record<SizeId, number>>> = {}
    for (const colorId of f.colors) {
      const row = f.stock[colorId]
      if (!row) continue
      const cell: Partial<Record<SizeId, number>> = {}
      for (const size of allSizes) {
        const value = Number(row[size])
        if (Number.isFinite(value) && value !== seedStockDefault(sd, colorId, size)) cell[size] = value
      }
      if (Object.keys(cell).length > 0) stockOverride[colorId] = cell
    }
    if (Object.keys(stockOverride).length > 0) override.stock = stockOverride
    const d = f.description.trim()
    if (d && d !== texts.description) override.description = d
    const fc = f.fabricCare.trim()
    if (fc && fc !== texts.fabricCare) override.fabricCare = fc
    const dr = f.deliveryReturns.trim()
    if (dr && dr !== texts.deliveryReturns) override.deliveryReturns = dr
    if (f.nameEn.trim()) override.nameEn = f.nameEn.trim()
    if (f.descriptionEn.trim()) override.descriptionEn = f.descriptionEn.trim()
    if (f.fabricCareEn.trim()) override.fabricCareEn = f.fabricCareEn.trim()
    if (!sameSet(f.similarProductIds, sd.similarProductIds ?? [])) override.similarProductIds = f.similarProductIds
    if (!sameSet(f.completeLookProductIds, sd.completeLookProductIds ?? [])) override.completeLookProductIds = f.completeLookProductIds
    const productId = currentProduct.id
    updateAdminData((current) => {
      const products = { ...current.products }
      if (Object.keys(override).length === 0) delete products[productId]
      else products[productId] = override
      return { ...current, products }
    })
    setBaseline(f)
    toast.success(AS.save.savedLocal)
  }

  function reset() {
    const productId = currentProduct.id
    updateAdminData((current) => {
      const products = { ...current.products }
      delete products[productId]
      return { ...current, products }
    })
    const fresh = buildFormFromSeed(sd, currentProduct.number)
    setForm(fresh)
    setBaseline(fresh)
    setConfirmReset(false)
    toast.success(AS.productEdit.resetDone)
  }

  return (
    <>
      <EditHeader
        product={product}
        form={form}
        extra={
          <Btn variant="ghost" icon="refresh" onClick={() => setConfirmReset(true)}>
            {AS.productEdit.resetToDefault}
          </Btn>
        }
      />
      <Notice tone="warning">{AS.demoNotice}</Notice>
      <ProductFormView
        mode="local"
        tab={tab}
        onTab={setTab}
        form={form}
        changed={changed}
        errors={errors}
        update={update}
        setForm={setForm}
        config={localInventoryConfig()}
        others={allProducts.filter((p) => p.id !== product.id)}
        currentBadgeActive={product.isNew}
        savedBadgeMode={product.isNew ? 'on' : 'off'}
        productColorLabel={colorOptionLabel}
        seedDefault={(colorId, size) => seedStockDefault(sd, colorId, size)}
        media={
          <>
            <Notice tone="neutral">{AS.productEdit.mediaHint}</Notice>
            <div className={ui.slotGrid}>
              {MEDIA_KINDS.map(({ kind, label }) => (
                <MediaField key={kind} name={productMediaName(product.number, kind)} label={label} />
              ))}
            </div>
          </>
        }
      />
      <StickySaveBar
        dirty={changed.size > 0}
        changes={changed.size}
        onSave={() => save()}
        onDiscard={() => {
          setForm(baseline)
          setErrors({})
          toast.info(AS.save.discarded)
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        title={AS.productEdit.resetConfirmTitle}
        message={AS.productEdit.resetConfirmText}
        confirmLabel={AS.productEdit.resetToDefault}
        tone="danger"
        onCancel={() => setConfirmReset(false)}
        onConfirm={reset}
      />
      <ConfirmDialog
        open={confirmZero}
        title={AS.productEdit.priceZeroTitle}
        message={AS.productEdit.priceZeroText}
        confirmLabel={AS.productEdit.priceZeroConfirm}
        onCancel={() => setConfirmZero(false)}
        onConfirm={() => {
          setConfirmZero(false)
          save(true)
        }}
      />
    </>
  )
}

/* ==================== Ortak görünüm ==================== */

function LoadingState() {
  return (
    <div className={ui.card}>
      <EmptyState icon="refresh" title={AS.common.loading} />
    </div>
  )
}

function NotFound() {
  return (
    <>
      <PageHeader title={AS.productEdit.notFound} back={{ to: '/admin/urunler', label: AS.productEdit.backToList }} />
      <div className={ui.card}>
        <EmptyState
          icon="products"
          title={AS.productEdit.notFound}
          action={
            <Btn to="/admin/urunler" icon="chevron-left">
              {AS.productEdit.backToList}
            </Btn>
          }
        />
      </div>
    </>
  )
}

function EditHeader({ product, form, extra }: { product: AnyProduct; form: FormState; extra?: ReactNode }) {
  return (
    <PageHeader
      back={{ to: '/admin/urunler', label: AS.productEdit.backToList }}
      title={form.name.trim() || AS.productEdit.title(product.number)}
      description={AS.productEdit.title(product.number)}
      meta={product.hidden ? <StatusBadge tone="neutral">{AS.productEdit.hiddenBadge}</StatusBadge> : <StatusBadge tone="success">{AS.productEdit.visibleBadge}</StatusBadge>}
      actions={
        <>
          {extra}
          {!product.hidden ? (
            <a className={[ui.btn, ui.btnSecondary].join(' ')} href={`/urun/${product.slug}`} target="_blank" rel="noopener noreferrer">
              {AS.productEdit.viewInStore}
            </a>
          ) : null}
        </>
      }
    />
  )
}

interface FormViewProps {
  mode: 'api' | 'local'
  tab: TabId
  onTab: (t: TabId) => void
  form: FormState
  changed: Set<keyof FormState>
  errors: Errors
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  setForm: (fn: (f: FormState | null) => FormState | null) => void
  config: InventoryConfig
  others: Product[] | AdminProduct[]
  currentBadgeActive: boolean
  savedBadgeMode: NewBadgeMode
  productColorLabel: (colorId: string) => string
  /** Yerel modda yeni eklenen rengin varsayılan stoğu (tohum veri). */
  seedDefault?: (colorId: string, size: SizeId) => number
  media: ReactNode
}

function ProductFormView({ mode, tab, onTab, form, changed, errors, update, setForm, config, others, currentBadgeActive, savedBadgeMode, productColorLabel, seedDefault, media }: FormViewProps) {
  const api = mode === 'api'
  const tabHas = (t: TabId) => TAB_FIELDS[t].some((k) => changed.has(k)) || (Object.keys(errors) as (keyof Errors)[]).some((k) => errors[k] && ERROR_TAB[k] === t)
  const labelOf = (cid: string) => (api ? form.colorLabels[cid]?.trim() || productColorLabel(cid) : productColorLabel(cid))

  function toggleColor(colorId: string, checked: boolean) {
    setForm((f) => {
      if (!f) return f
      let nextColors = checked ? [...f.colors, colorId] : f.colors.filter((c) => c !== colorId)
      if (nextColors.length === 0) nextColors = f.colors
      const stock = { ...f.stock }
      if (checked && !stock[colorId]) {
        const row = {} as Record<SizeId, string>
        for (const size of allSizes) row[size] = String(seedDefault ? seedDefault(colorId, size) : 0)
        stock[colorId] = row
      }
      const colorLabels = checked && !f.colorLabels[colorId] ? { ...f.colorLabels, [colorId]: productColorLabel(colorId) } : f.colorLabels
      return { ...f, colors: nextColors, stock, colorLabels }
    })
  }

  function toggleRelated(field: 'similarProductIds' | 'completeLookProductIds', otherId: string, checked: boolean) {
    setForm((f) => (f ? { ...f, [field]: checked ? [...f[field], otherId] : f[field].filter((v) => v !== otherId) } : f))
  }

  const tabs = [
    { id: 'general' as const, label: AS.productEdit.tabGeneral },
    { id: 'pricing' as const, label: AS.productEdit.tabPricing },
    { id: 'media' as const, label: AS.productEdit.tabMedia },
    { id: 'english' as const, label: AS.productEdit.tabEnglish },
    { id: 'related' as const, label: AS.productEdit.tabRelated },
  ].map((t) => ({ ...t, dot: tabHas(t.id), dotLabel: AS.productEdit.tabHasChanges }))

  return (
    <div style={{ maxWidth: 960 }}>
      <Tabs label={AS.productEdit.tabsLabel} tabs={tabs} active={tab} onChange={onTab} idPrefix="pe" />

      <div {...tabPanelProps('pe', 'general', tab)}>
        <FormSection title={AS.productEdit.basicsTitle}>
          <div className={ui.formGrid}>
            <TextField label={AS.productEdit.nameLabel} value={form.name} maxLength={200} error={errors.name} onChange={(e) => update('name', e.target.value)} wrapClassName={ui.span2} />
            <SelectField label={AS.productEdit.categoryLabel} value={form.category} onChange={(e) => update('category', e.target.value as CategoryValue)}>
              {editableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </SelectField>
          </div>
        </FormSection>
        <FormSection title={AS.productEdit.visibilityTitle}>
          <div className={ui.stack}>
            <SwitchField label={AS.productEdit.hiddenLabel} hint={AS.productEdit.hiddenHint} checked={form.hidden} onChange={(e) => update('hidden', e.target.checked)} />
            {api ? (
              <div className={ui.stackSm}>
                <Segmented
                  label={AS.productEdit.newBadgeLabel}
                  value={form.newBadge}
                  onChange={(v) => update('newBadge', v)}
                  options={[
                    { value: 'on', label: AS.productEdit.newBadgeOn },
                    { value: 'auto', label: AS.productEdit.newBadgeAuto(config.newBadgeDays) },
                    { value: 'off', label: AS.productEdit.newBadgeOff },
                  ]}
                />
                {form.newBadge === savedBadgeMode ? <p className={ui.hint}>{AS.productEdit.newBadgeState(currentBadgeActive)}</p> : null}
              </div>
            ) : (
              <SwitchField label={AS.productEdit.isNewLabel} checked={form.isNew} onChange={(e) => update('isNew', e.target.checked)} />
            )}
          </div>
        </FormSection>
        <FormSection title={AS.productEdit.contentTitle}>
          <div className={ui.stack}>
            <TextAreaField label={AS.productEdit.descriptionLabel} rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} />
            <TextAreaField label={AS.productEdit.fabricCareLabel} rows={3} value={form.fabricCare} onChange={(e) => update('fabricCare', e.target.value)} />
            <TextAreaField
              label={AS.productEdit.deliveryReturnsLabel}
              hint={AS.productEdit.deliveryReturnsHint}
              rows={3}
              value={form.deliveryReturns}
              onChange={(e) => update('deliveryReturns', e.target.value)}
            />
          </div>
        </FormSection>
      </div>

      <div {...tabPanelProps('pe', 'pricing', tab)}>
        <FormSection title={AS.productEdit.priceTitle}>
          <div className={ui.formGrid}>
            <TextField label={AS.productEdit.priceLabel} inputMode="decimal" suffix="TL" value={form.price} error={errors.price} onChange={(e) => update('price', e.target.value)} />
          </div>
        </FormSection>
        <FormSection title={AS.productEdit.colorsTitle} description={AS.productEdit.colorsHint}>
          <div>
            {colorOptions.map((opt) => {
              const checked = form.colors.includes(opt.id)
              return (
                <div key={opt.id} className={styles.colorRow}>
                  <CheckField
                    label={api ? <span className="sr-only">{productColorLabel(opt.id)}</span> : productColorLabel(opt.id)}
                    checked={checked}
                    onChange={(e) => toggleColor(opt.id, e.target.checked)}
                    aria-label={productColorLabel(opt.id)}
                  />
                  {api ? (
                    <TextField
                      label={AS.productEdit.colorNameLabel(opt.id)}
                      hideLabel
                      maxLength={64}
                      disabled={!checked}
                      value={checked ? (form.colorLabels[opt.id] ?? '') : productColorLabel(opt.id)}
                      error={checked && errors.colorLabels && !(form.colorLabels[opt.id] ?? '').trim() ? errors.colorLabels : null}
                      onChange={(e) => update('colorLabels', { ...form.colorLabels, [opt.id]: e.target.value })}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </FormSection>
        <FormSection title={AS.productEdit.stockTitle} description={AS.productEdit.stockHint(config.lowStockThreshold)}>
          {errors.stock ? <Notice tone="danger">{errors.stock}</Notice> : null}
          <StockMatrix colors={form.colors} labelOf={labelOf} stock={form.stock} threshold={config.lowStockThreshold} onChange={(stock) => update('stock', stock)} />
        </FormSection>
      </div>

      <div {...tabPanelProps('pe', 'media', tab)}>
        <FormSection title={AS.productEdit.mediaTitle}>{media}</FormSection>
      </div>

      <div {...tabPanelProps('pe', 'english', tab)}>
        <FormSection title={AS.productEdit.englishTitle} description={AS.productEdit.englishHint}>
          <div className={ui.stack}>
            <div className={styles.enPair}>
              <TextField label={AS.productEdit.nameLabel} value={form.name} disabled readOnly />
              <TextField label={AS.productEdit.nameEnLabel} lang="en" maxLength={200} placeholder={AS.productEdit.enPlaceholder} value={form.nameEn} onChange={(e) => update('nameEn', e.target.value)} />
            </div>
            <div className={styles.enPair}>
              <TextAreaField label={AS.productEdit.descriptionLabel} rows={4} value={form.description} disabled readOnly />
              <TextAreaField
                label={AS.productEdit.descriptionEnLabel}
                lang="en"
                rows={4}
                placeholder={AS.productEdit.enPlaceholder}
                value={form.descriptionEn}
                onChange={(e) => update('descriptionEn', e.target.value)}
              />
            </div>
            <div className={styles.enPair}>
              <TextAreaField label={AS.productEdit.fabricCareLabel} rows={3} value={form.fabricCare} disabled readOnly />
              <TextAreaField
                label={AS.productEdit.fabricCareEnLabel}
                lang="en"
                rows={3}
                placeholder={AS.productEdit.enPlaceholder}
                value={form.fabricCareEn}
                onChange={(e) => update('fabricCareEn', e.target.value)}
              />
            </div>
          </div>
        </FormSection>
        {api ? (
          <FormSection title={AS.productEdit.colorLabelsEnTitle}>
            <div className={ui.formGrid}>
              {form.colors.map((colorId) => (
                <TextField
                  key={colorId}
                  label={AS.productEdit.colorLabelEn(labelOf(colorId))}
                  lang="en"
                  maxLength={64}
                  placeholder={AS.productEdit.enPlaceholder}
                  value={form.colorLabelsEn[colorId] ?? ''}
                  onChange={(e) => update('colorLabelsEn', { ...form.colorLabelsEn, [colorId]: e.target.value })}
                />
              ))}
            </div>
          </FormSection>
        ) : null}
      </div>

      <div {...tabPanelProps('pe', 'related', tab)}>
        <RelatedPicker
          title={AS.productEdit.similarTitle}
          hint={AS.productEdit.similarHint}
          others={others}
          selected={form.similarProductIds}
          onToggle={(pid, on) => toggleRelated('similarProductIds', pid, on)}
        />
        <RelatedPicker
          title={AS.productEdit.completeLookTitle}
          hint={AS.productEdit.completeLookHint}
          others={others}
          selected={form.completeLookProductIds}
          onToggle={(pid, on) => toggleRelated('completeLookProductIds', pid, on)}
        />
      </div>
    </div>
  )
}

function RelatedPicker({ title, hint, others, selected, onToggle }: { title: string; hint: string; others: (Product | AdminProduct)[]; selected: string[]; onToggle: (id: string, on: boolean) => void }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLocaleLowerCase('tr-TR')
  const list = needle ? others.filter((p) => p.name.toLocaleLowerCase('tr-TR').includes(needle) || p.number.includes(needle)) : others
  return (
    <FormSection title={title} description={hint} actions={<StatusBadge tone="neutral" dot={false}>{AS.productEdit.selectedCount(selected.length)}</StatusBadge>}>
      <div className={ui.stack}>
        <TextField label={AS.productEdit.relatedFilter} hideLabel type="search" placeholder={AS.productEdit.relatedFilter} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={styles.checkGrid} role="group" aria-label={title}>
          {list.map((p) => (
            <CheckField key={p.id} label={`${p.number} — ${p.name}`} checked={selected.includes(p.id)} onChange={(e) => onToggle(p.id, e.target.checked)} />
          ))}
        </div>
      </div>
    </FormSection>
  )
}

interface StockMatrixProps {
  colors: string[]
  labelOf: (colorId: string) => string
  stock: FormState['stock']
  threshold: number
  onChange: (stock: FormState['stock']) => void
}

/**
 * Renk × beden stok matrisi: düşük stok (1..eşik) sarı, tükendi gri, geçersiz kırmızı. "Tüm hücrelere
 * doldur", satırı diğer renklere kopyala, sütunda ilk satırı aşağı kopyala; satır toplamları.
 */
function StockMatrix({ colors, labelOf, stock, threshold, onChange }: StockMatrixProps) {
  const [fill, setFill] = useState('')
  const fillValid = validStockValue(fill)
  const cell = (cid: string, size: SizeId) => stock[cid]?.[size] ?? '0'

  function setCell(cid: string, size: SizeId, value: string) {
    onChange({ ...stock, [cid]: { ...stock[cid], [size]: value } })
  }
  function fillAll() {
    if (!fillValid) return
    const next = { ...stock }
    for (const cid of colors) next[cid] = Object.fromEntries(allSizes.map((s) => [s, fill.trim()])) as Record<SizeId, string>
    onChange(next)
  }
  function copyRow(from: string) {
    const next = { ...stock }
    for (const cid of colors) if (cid !== from) next[cid] = { ...stock[from] }
    onChange(next)
  }
  function copyColumn(size: SizeId) {
    const first = colors[0]
    if (!first) return
    const v = cell(first, size)
    const next = { ...stock }
    for (const cid of colors) next[cid] = { ...stock[cid], [size]: v }
    onChange(next)
  }
  const rowTotal = (cid: string) => allSizes.reduce((sum, s) => sum + (validStockValue(cell(cid, s)) ? Number(cell(cid, s)) : 0), 0)

  return (
    <>
      <div className={styles.stockToolbar}>
        <TextField label={AS.productEdit.fillAllLabel} inputMode="numeric" value={fill} onChange={(e) => setFill(e.target.value)} placeholder="0" />
        <Btn onClick={fillAll} disabled={!fillValid}>
          {AS.productEdit.fillAll}
        </Btn>
      </div>
      <div className={styles.stockWrap}>
        <table className={styles.stockTable}>
          <caption className="sr-only">{AS.productEdit.stockTitle}</caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left' }}>
                {AS.productEdit.colorsTitle}
              </th>
              {allSizes.map((size) => (
                <th key={size} scope="col">
                  <span className={styles.colHead}>
                    {size}
                    {colors.length > 1 ? (
                      <button type="button" className={styles.miniBtn} onClick={() => copyColumn(size)} aria-label={AS.productEdit.copyColumnAria(size)}>
                        {AS.productEdit.copyColumn}
                      </button>
                    ) : null}
                  </span>
                </th>
              ))}
              <th scope="col">{AS.productEdit.rowTotal}</th>
            </tr>
          </thead>
          <tbody>
            {colors.map((cid) => {
              const label = labelOf(cid)
              return (
                <tr key={cid}>
                  <th scope="row">
                    <div>{label}</div>
                    {colors.length > 1 ? (
                      <button type="button" className={styles.miniBtn} style={{ paddingLeft: 0 }} onClick={() => copyRow(cid)} aria-label={AS.productEdit.copyRowAria(label)}>
                        {AS.productEdit.copyRow}
                      </button>
                    ) : null}
                  </th>
                  {allSizes.map((size) => {
                    const raw = cell(cid, size)
                    const valid = validStockValue(raw)
                    const level = valid ? stockLevel(Number(raw), threshold) : 'ok'
                    const note = level === 'low' ? AS.productEdit.cellLow : level === 'out' ? AS.productEdit.cellOut : null
                    return (
                      <td key={size} className={level === 'low' ? styles.cellLow : level === 'out' ? styles.cellOut : undefined}>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`${label} ${size}${note ? ` — ${note}` : ''}`}
                          aria-invalid={valid ? undefined : true}
                          value={raw}
                          onChange={(e) => setCell(cid, size, e.target.value)}
                          onFocus={(e) => e.target.select()}
                        />
                      </td>
                    )
                  })}
                  <td className={styles.stockTotal}>{rowTotal(cid)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
