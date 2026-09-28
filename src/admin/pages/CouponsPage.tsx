import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiErrorMessage } from '../../i18n/apiMessages'
import {
  createAdminCoupon,
  deleteAdminCoupon,
  isUnavailable,
  listAdminCoupons,
  updateAdminCoupon,
  useApiMode,
  type AdminCoupon,
  type AdminCouponInput,
  type CouponType,
} from '../adminApi'
import { AS } from '../adminStrings'
import { Btn } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DataTable, type Column } from '../ui/DataTable'
import { Drawer } from '../ui/Drawer'
import { FilterBar, FilterSelect } from '../ui/FilterBar'
import { Segmented, SwitchField, TextField } from '../ui/Form'
import { FormSection } from '../ui/FormSection'
import { EmptyState, ErrorState, PageHeader, UnavailableState } from '../ui/Page'
import { StatusBadge } from '../ui/StatusBadge'
import type { BadgeTone } from '../ui/tones'
import { formatDate, formatPrice, isoDay, parseAmount, parseOptionalInt } from '../ui/format'
import { useToast } from '../ui/toastContext'
import { useLoader } from '../ui/useLoader'
import ui from '../ui/ui.module.css'

/** Sunucu kuralıyla aynı (api/src/services/coupons.js → COUPON_CODE_RE). */
const CODE_RE = /^[A-Z0-9_-]{4,40}$/

type CouponState = 'active' | 'inactive' | 'scheduled' | 'expired' | 'exhausted'

function couponState(c: AdminCoupon, now = Date.now()): CouponState {
  if (!c.active) return 'inactive'
  if (c.expiresAt && now >= Date.parse(c.expiresAt)) return 'expired'
  if (c.startsAt && now < Date.parse(c.startsAt)) return 'scheduled'
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return 'exhausted'
  return 'active'
}

const STATE_UI: Record<CouponState, { label: string; tone: BadgeTone }> = {
  active: { label: AS.coupons.statusActive, tone: 'success' },
  inactive: { label: AS.coupons.statusInactive, tone: 'neutral' },
  scheduled: { label: AS.coupons.statusScheduled, tone: 'warning' },
  expired: { label: AS.coupons.statusExpired, tone: 'danger' },
  exhausted: { label: AS.coupons.statusExhausted, tone: 'neutral' },
}

const valueText = (c: Pick<AdminCoupon, 'type' | 'value'>) => (c.type === 'percent' ? `%${c.value}` : formatPrice(c.value))

/** Bitiş: seçilen günün SONUNA kadar geçerli → ertesi gün yerel 00:00 ISO. Gösterimde 1 ms geri alınır. */
const startIso = (day: string) => (day ? new Date(`${day}T00:00:00`).toISOString() : null)
const endIso = (day: string) => {
  if (!day) return null
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}
const startDay = (iso: string | null) => (iso ? isoDay(new Date(iso)) : '')
const endDay = (iso: string | null) => (iso ? isoDay(new Date(Date.parse(iso) - 1)) : '')

function validityText(c: AdminCoupon): string {
  const a = c.startsAt ? formatDate(c.startsAt) : null
  const b = c.expiresAt ? formatDate(new Date(Date.parse(c.expiresAt) - 1).toISOString()) : null
  if (a && b) return AS.coupons.validityRange(a, b)
  if (a) return AS.coupons.validityFrom(a)
  if (b) return AS.coupons.validityUntil(b)
  return AS.coupons.validityAlways
}

/** `/admin/kuponlar` — liste, oluştur/düzenle (drawer), pasifleştir/etkinleştir, sil (onaylı). */
export function CouponsPage() {
  if (!useApiMode) {
    return (
      <div>
        <PageHeader title={AS.coupons.title} description={AS.coupons.subtitle} />
        <div className={ui.card}>
          <EmptyState icon="coupons" title={AS.ui.localOnlyTitle} text={AS.ui.localOnlyText(AS.coupons.feature)} />
        </div>
      </div>
    )
  }
  return <ApiCouponsPage />
}

function ApiCouponsPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const list = useLoader(listAdminCoupons)
  const [q, setQ] = useState('')
  const [state, setState] = useState<'' | CouponState>('')
  const [editing, setEditing] = useState<AdminCoupon | 'new' | null>(() => (params.get('yeni') === '1' ? 'new' : null))
  const [toDelete, setToDelete] = useState<AdminCoupon | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  if (list.error && !list.data) {
    return (
      <div>
        <PageHeader title={AS.coupons.title} description={AS.coupons.subtitle} />
        {isUnavailable(list.error) ? <UnavailableState feature={AS.coupons.feature} /> : <ErrorState message={apiErrorMessage(list.error)} onRetry={list.reload} />}
      </div>
    )
  }

  const needle = q.trim().toUpperCase()
  const rows = list.data ? list.data.filter((c) => (!needle || c.code.includes(needle)) && (!state || couponState(c) === state)) : null

  function upsert(c: AdminCoupon) {
    list.setData((l) => {
      const arr = l ?? []
      return arr.some((x) => x.id === c.id) ? arr.map((x) => (x.id === c.id ? c : x)) : [c, ...arr]
    })
  }

  async function toggleActive(c: AdminCoupon) {
    setBusyId(c.id)
    try {
      const updated = await updateAdminCoupon(c.id, { active: !c.active })
      upsert(updated)
      toast.success(updated.active ? AS.coupons.activated : AS.coupons.deactivated)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  async function doDelete() {
    if (!toDelete) return
    const c = toDelete
    setBusyId(c.id)
    try {
      const { deactivated } = await deleteAdminCoupon(c.id)
      if (deactivated) {
        upsert({ ...c, active: false })
        toast.warning(AS.coupons.deletedDeactivated)
      } else {
        list.setData((l) => (l ?? []).filter((x) => x.id !== c.id))
        toast.success(AS.coupons.deleted)
      }
      setToDelete(null)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  function closeEditor() {
    setEditing(null)
    if (params.get('yeni')) setParams({}, { replace: true })
  }

  const columns: Column<AdminCoupon>[] = [
    {
      key: 'code',
      header: AS.coupons.colCode,
      primary: true,
      sortValue: (c) => c.code,
      render: (c) => <span className={ui.cellTitle} style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{c.code}</span>,
    },
    { key: 'type', header: AS.coupons.colType, sortValue: (c) => c.type, render: (c) => (c.type === 'percent' ? AS.coupons.typePercent : AS.coupons.typeFixed) },
    { key: 'value', header: AS.coupons.colValue, align: 'right', sortValue: (c) => c.value, render: (c) => <span className={ui.num}>{valueText(c)}</span> },
    { key: 'usage', header: AS.coupons.colUsage, sortValue: (c) => c.usedCount, render: (c) => <span className={ui.num}>{AS.coupons.usage(c.usedCount, c.usageLimit)}</span> },
    { key: 'validity', header: AS.coupons.colValidity, sortValue: (c) => c.expiresAt ?? '9999', render: (c) => <span className={ui.small}>{validityText(c)}</span> },
    {
      key: 'status',
      header: AS.coupons.colStatus,
      sortValue: (c) => couponState(c),
      render: (c) => {
        const s = STATE_UI[couponState(c)]
        return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title={AS.coupons.title}
        description={AS.coupons.subtitle}
        actions={
          <Btn variant="primary" icon="plus" onClick={() => setEditing('new')}>
            {AS.coupons.add}
          </Btn>
        }
      />
      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: AS.coupons.searchPlaceholder }}
        active={!!(q || state)}
        onClear={() => {
          setQ('')
          setState('')
        }}
      >
        <FilterSelect label={AS.coupons.statusFilter} value={state} onChange={(e) => setState(e.target.value as '' | CouponState)}>
          <option value="">{AS.common.all}</option>
          {(Object.keys(STATE_UI) as CouponState[]).map((k) => (
            <option key={k} value={k}>
              {STATE_UI[k].label}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>
      <DataTable
        caption={AS.coupons.title}
        columns={columns}
        rows={rows}
        rowKey={(c) => String(c.id)}
        resetKey={`${q}|${state}`}
        onRowClick={(c) => setEditing(c)}
        rowLabel={(c) => AS.coupons.editTitle(c.code)}
        rowActions={(c) => (
          <>
            <Btn size="sm" variant="ghost" icon="edit" iconOnly label={AS.coupons.editTitle(c.code)} onClick={() => setEditing(c)} />
            <Btn size="sm" variant="ghost" loading={busyId === c.id} onClick={() => void toggleActive(c)}>
              {c.active ? AS.coupons.deactivate : AS.coupons.activate}
            </Btn>
            <Btn size="sm" variant="ghost" icon="trash" iconOnly label={`${AS.common.delete}: ${c.code}`} onClick={() => setToDelete(c)} />
          </>
        )}
        empty={
          q || state ? (
            <EmptyState icon="search" title={AS.coupons.emptyFiltered} />
          ) : (
            <EmptyState
              icon="coupons"
              title={AS.coupons.empty}
              text={AS.coupons.emptyText}
              action={
                <Btn variant="primary" icon="plus" onClick={() => setEditing('new')}>
                  {AS.coupons.add}
                </Btn>
              }
            />
          )
        }
      />

      {editing ? (
        <CouponEditor
          key={editing === 'new' ? 'new' : editing.id}
          coupon={editing === 'new' ? null : editing}
          onClose={closeEditor}
          onSaved={(c, created) => {
            upsert(c)
            toast.success(created ? AS.coupons.created : AS.coupons.saved)
            closeEditor()
          }}
        />
      ) : null}

      <ConfirmDialog
        open={toDelete != null}
        title={toDelete ? AS.coupons.deleteTitle(toDelete.code) : ''}
        message={AS.coupons.deleteText}
        confirmLabel={AS.coupons.deleteConfirm}
        tone="danger"
        pending={toDelete != null && busyId === toDelete.id}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void doDelete()}
      />
    </div>
  )
}

interface CouponForm {
  code: string
  type: CouponType
  value: string
  minSubtotal: string
  usageLimit: string
  perCustomerLimit: string
  startsAt: string
  expiresAt: string
  active: boolean
}

type CouponErrors = Partial<Record<keyof CouponForm, string>>

function toForm(c: AdminCoupon | null): CouponForm {
  return {
    code: c?.code ?? '',
    type: c?.type ?? 'percent',
    value: c ? String(c.value) : '',
    minSubtotal: c?.minSubtotal != null ? String(c.minSubtotal) : '',
    usageLimit: c?.usageLimit != null ? String(c.usageLimit) : '',
    perCustomerLimit: c?.perCustomerLimit != null ? String(c.perCustomerLimit) : '',
    startsAt: startDay(c?.startsAt ?? null),
    expiresAt: endDay(c?.expiresAt ?? null),
    active: c?.active ?? true,
  }
}

function CouponEditor({ coupon, onClose, onSaved }: { coupon: AdminCoupon | null; onClose: () => void; onSaved: (c: AdminCoupon, created: boolean) => void }) {
  const toast = useToast()
  const [form, setForm] = useState<CouponForm>(() => toForm(coupon))
  const [errors, setErrors] = useState<CouponErrors>({})
  const [pending, setPending] = useState(false)

  function set<K extends keyof CouponForm>(k: K, v: CouponForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  function validate(): AdminCouponInput | null {
    const e: CouponErrors = {}
    const code = form.code.trim().toUpperCase()
    if (!CODE_RE.test(code)) e.code = AS.coupons.codeInvalid
    const value = parseAmount(form.value)
    if (form.type === 'percent' && (value == null || value <= 0 || value > 100)) e.value = AS.coupons.valueInvalidPercent
    if (form.type === 'fixed' && (value == null || value <= 0)) e.value = AS.coupons.valueInvalidFixed
    const minSubtotal = form.minSubtotal.trim() ? parseAmount(form.minSubtotal) : null
    if (form.minSubtotal.trim() && minSubtotal == null) e.minSubtotal = AS.coupons.amountInvalid
    const usageLimit = parseOptionalInt(form.usageLimit, 1)
    if (usageLimit === undefined) e.usageLimit = AS.coupons.intInvalid
    const perCustomerLimit = parseOptionalInt(form.perCustomerLimit, 1)
    if (perCustomerLimit === undefined) e.perCustomerLimit = AS.coupons.intInvalid
    if (form.startsAt && form.expiresAt && form.expiresAt < form.startsAt) e.expiresAt = AS.coupons.datesInvalid
    setErrors(e)
    if (Object.keys(e).length) return null
    return {
      code,
      type: form.type,
      value: Math.round(value! * 100) / 100,
      minSubtotal: minSubtotal == null ? null : Math.round(minSubtotal * 100) / 100,
      usageLimit: usageLimit ?? null,
      perCustomerLimit: perCustomerLimit ?? null,
      startsAt: startIso(form.startsAt),
      expiresAt: endIso(form.expiresAt),
      active: form.active,
    }
  }

  async function submit() {
    const data = validate()
    if (!data) return
    setPending(true)
    try {
      const saved = coupon ? await updateAdminCoupon(coupon.id, data) : await createAdminCoupon(data)
      onSaved(saved, !coupon)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={coupon ? AS.coupons.editTitle(coupon.code) : AS.coupons.createTitle}
      subtitle={coupon ? `${AS.coupons.usedCount(coupon.usedCount)} · ${AS.coupons.createdAt}: ${formatDate(coupon.createdAt)}` : undefined}
      footer={
        <>
          <Btn onClick={onClose} disabled={pending}>
            {AS.ui.cancel}
          </Btn>
          <Btn variant="primary" loading={pending} onClick={() => void submit()}>
            {coupon ? AS.coupons.save : AS.coupons.create}
          </Btn>
        </>
      }
    >
      <form
        className={ui.stack}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <TextField
          label={AS.coupons.codeLabel}
          hint={AS.coupons.codeHint}
          value={form.code}
          maxLength={40}
          autoCapitalize="characters"
          spellCheck={false}
          style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
          error={errors.code}
          onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s+/g, ''))}
        />
        <div className={ui.formGrid}>
          <Segmented
            label={AS.coupons.typeLabel}
            value={form.type}
            onChange={(v) => set('type', v)}
            options={[
              { value: 'percent', label: AS.coupons.typePercent },
              { value: 'fixed', label: AS.coupons.typeFixed },
            ]}
          />
          <TextField
            label={form.type === 'percent' ? AS.coupons.valueLabelPercent : AS.coupons.valueLabelFixed}
            inputMode="decimal"
            suffix={form.type === 'percent' ? '%' : 'TL'}
            value={form.value}
            error={errors.value}
            onChange={(e) => set('value', e.target.value)}
          />
        </div>
        <FormSection title={AS.coupons.rulesTitle}>
          <div className={ui.formGrid}>
            <TextField
              label={AS.coupons.minSubtotalLabel}
              hint={AS.coupons.minSubtotalHint}
              inputMode="decimal"
              suffix="TL"
              value={form.minSubtotal}
              error={errors.minSubtotal}
              onChange={(e) => set('minSubtotal', e.target.value)}
            />
            <TextField label={AS.coupons.usageLimitLabel} hint={AS.coupons.usageLimitHint} inputMode="numeric" value={form.usageLimit} error={errors.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} />
            <TextField
              label={AS.coupons.perCustomerLabel}
              hint={AS.coupons.perCustomerHint}
              inputMode="numeric"
              value={form.perCustomerLimit}
              error={errors.perCustomerLimit}
              onChange={(e) => set('perCustomerLimit', e.target.value)}
            />
          </div>
        </FormSection>
        <FormSection title={AS.coupons.validityTitle}>
          <div className={ui.stack}>
            <div className={ui.formGrid}>
              <TextField label={AS.coupons.startsAtLabel} type="date" value={form.startsAt} max={form.expiresAt || undefined} onChange={(e) => set('startsAt', e.target.value)} />
              <TextField label={AS.coupons.expiresAtLabel} type="date" value={form.expiresAt} min={form.startsAt || undefined} error={errors.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
            </div>
            <SwitchField label={AS.coupons.activeLabel} hint={AS.coupons.activeHint} checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          </div>
        </FormSection>
        <button type="submit" hidden />
      </form>
    </Drawer>
  )
}
