import { useEffect, useMemo, useState } from 'react'
import { defaultSettings, siteSettings } from '../../config/settings'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { getAdminSettings, updateAdminSettings, useApiMode } from '../adminApi'
import { updateAdminData } from '../adminStore'
import { AS } from '../adminStrings'
import { intSetting, MAX_STOCK_QTY } from '../inventory'
import { CheckField, SelectField, SwitchField, TextField } from '../ui/Form'
import { FormSection } from '../ui/FormSection'
import { ErrorState, Notice, PageHeader } from '../ui/Page'
import { StickySaveBar } from '../ui/StickySaveBar'
import { StatusBadge } from '../ui/StatusBadge'
import { parseAmount } from '../ui/format'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'

/** iyzico'nun desteklediği taksit sayıları (sunucu şemasıyla aynı — api/src/routes/admin-settings.js). */
const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12] as const

interface SettingsForm {
  brandName: string
  brandShortName: string
  discountEnabled: boolean
  discountPercent: string
  discountMode: 'automatic' | 'code'
  discountCode: string
  discountMinSubtotal: string
  discountUsageLimit: string
  discountExpiresAt: string
  discountFirstOrderOnly: boolean
  shippingAmount: string
  shippingFreeOver: string
  installmentsMode: 'default' | 'custom'
  installments: number[]
  whatsapp: string
  supportEmail: string
  instagram: string
  tiktok: string
  pinterest: string
  offerDelayMs: string
  lowStockThreshold: string
  newBadgeDays: string
}

type Errors = Partial<Record<keyof SettingsForm, string>>

const numOrEmpty = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '')

function cleanInstallments(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null
  const list = v.filter((n): n is number => (INSTALLMENT_OPTIONS as readonly number[]).includes(n as number))
  return list.length ? [...new Set(list)].sort((a, b) => a - b) : null
}

function buildInitialForm(): SettingsForm {
  const s = siteSettings
  const local = s as unknown as { shipping: { freeOver?: number | null } }
  return {
    brandName: s.brand.name,
    brandShortName: s.brand.shortName,
    discountEnabled: s.memberDiscount.enabled,
    discountPercent: String(s.memberDiscount.percent),
    discountMode: s.memberDiscount.mode as 'automatic' | 'code',
    discountCode: s.memberDiscount.code ?? '',
    discountMinSubtotal: s.memberDiscount.minSubtotal == null ? '' : String(s.memberDiscount.minSubtotal),
    discountUsageLimit: s.memberDiscount.usageLimit == null ? '' : String(s.memberDiscount.usageLimit),
    discountExpiresAt: s.memberDiscount.expiresAt ? s.memberDiscount.expiresAt.slice(0, 10) : '',
    discountFirstOrderOnly: s.memberDiscount.firstOrderOnly !== false,
    shippingAmount: s.shipping.amount == null ? '' : String(s.shipping.amount),
    shippingFreeOver: numOrEmpty(local.shipping.freeOver),
    installmentsMode: 'default',
    installments: cleanInstallments(s.payment.installments) ?? [1],
    whatsapp: s.support.whatsappNumber ?? '',
    supportEmail: s.support.email ?? '',
    instagram: s.social.instagram ?? '',
    tiktok: s.social.tiktok ?? '',
    pinterest: s.social.pinterest ?? '',
    offerDelayMs: String(s.offerPanel.delayAfterConsentMs),
    lowStockThreshold: String(intSetting(s.inventory.lowStockThreshold, defaultSettings.inventory.lowStockThreshold, 0, MAX_STOCK_QTY)),
    newBadgeDays: String(intSetting(s.catalog.newBadgeDays, defaultSettings.catalog.newBadgeDays, 0, 3650)),
  }
}

/**
 * Yönetici `GET /admin/settings` yanıtından form doldurur — herkese açık `GET /settings` beyaz
 * listeli bir alt küme döner (`memberDiscount.code`/`usageLimit` hariç tutulur), bu yüzden panel
 * gerçek (redaksiyonsuz) değerler için ayrı uç noktayı kullanır. Eksik anahtar varsayılana düşer.
 */
function buildFormFromAdminSettings(raw: Record<string, unknown>): SettingsForm {
  const brandName = typeof raw['brand.name'] === 'string' ? (raw['brand.name'] as string) : defaultSettings.brand.name
  const brandShortName = typeof raw['brand.shortName'] === 'string' ? (raw['brand.shortName'] as string) : defaultSettings.brand.shortName
  const md = { ...defaultSettings.memberDiscount, ...(raw.memberDiscount as Partial<typeof defaultSettings.memberDiscount> | undefined) }
  const social = { ...defaultSettings.social, ...(raw.social as Partial<typeof defaultSettings.social> | undefined) }
  const shippingAmount = raw['shipping.amount']
  const offerDelay = raw['offerPanel.delayAfterConsentMs']
  const installments = cleanInstallments(raw['payment.installments'])
  return {
    brandName,
    brandShortName,
    discountEnabled: md.enabled,
    discountPercent: String(md.percent),
    discountMode: md.mode,
    discountCode: md.code ?? '',
    discountMinSubtotal: md.minSubtotal == null ? '' : String(md.minSubtotal),
    discountUsageLimit: md.usageLimit == null ? '' : String(md.usageLimit),
    discountExpiresAt: md.expiresAt ? md.expiresAt.slice(0, 10) : '',
    discountFirstOrderOnly: md.firstOrderOnly !== false,
    shippingAmount: typeof shippingAmount === 'number' ? String(shippingAmount) : '',
    shippingFreeOver: numOrEmpty(raw['shipping.freeOver']),
    installmentsMode: installments ? 'custom' : 'default',
    installments: installments ?? cleanInstallments(siteSettings.payment.installments) ?? [1],
    whatsapp: typeof raw['support.whatsappNumber'] === 'string' ? (raw['support.whatsappNumber'] as string) : '',
    supportEmail: typeof raw['support.email'] === 'string' ? (raw['support.email'] as string) : '',
    instagram: social.instagram ?? '',
    tiktok: social.tiktok ?? '',
    pinterest: social.pinterest ?? '',
    offerDelayMs: String(typeof offerDelay === 'number' ? offerDelay : defaultSettings.offerPanel.delayAfterConsentMs),
    lowStockThreshold: String(intSetting(raw['inventory.lowStockThreshold'], defaultSettings.inventory.lowStockThreshold, 0, MAX_STOCK_QTY)),
    newBadgeDays: String(intSetting(raw['catalog.newBadgeDays'], defaultSettings.catalog.newBadgeDays, 0, 3650)),
  }
}

/** Boşluksuz tam sayı ve [min, max] içinde → sayı; değilse null (kaydetme engellenir). */
function toIntInRange(v: string, min: number, max: number): number | null {
  const t = v.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n >= min && n <= max ? n : null
}

function toNullableString(v: string): string | null {
  const t = v.trim()
  return t ? t : null
}

/** Boş → null; geçerli tutar → sayı; geçersiz → undefined (hata). */
function optionalAmount(v: string): number | null | undefined {
  if (!v.trim()) return null
  const n = parseAmount(v)
  return n == null ? undefined : n
}

interface Parsed {
  percent: number
  minSubtotal: number | null
  usageLimit: number | null
  shippingAmount: number | null
  freeOver: number | null
  offerDelay: number
  lowStockThreshold: number
  newBadgeDays: number
  installments: number[] | null
}

function validate(form: SettingsForm): { errors: Errors; parsed: Parsed | null } {
  const errors: Errors = {}
  const percent = parseAmount(form.discountPercent)
  if (percent == null || percent < 0 || percent > 100) errors.discountPercent = AS.settings.percentInvalid
  const minSubtotal = optionalAmount(form.discountMinSubtotal)
  if (minSubtotal === undefined) errors.discountMinSubtotal = AS.settings.numberInvalid
  const usageLimitRaw = form.discountUsageLimit.trim()
  const usageLimit = usageLimitRaw ? toIntInRange(usageLimitRaw, 0, 1_000_000_000) : null
  if (usageLimitRaw && usageLimit == null) errors.discountUsageLimit = AS.settings.numberInvalid
  const shippingAmount = optionalAmount(form.shippingAmount)
  if (shippingAmount === undefined) errors.shippingAmount = AS.settings.numberInvalid
  const freeOver = optionalAmount(form.shippingFreeOver)
  if (freeOver === undefined) errors.shippingFreeOver = AS.settings.numberInvalid
  const offerDelay = toIntInRange(form.offerDelayMs, 0, 10_000_000)
  if (offerDelay == null) errors.offerDelayMs = AS.settings.numberInvalid
  const lowStockThreshold = toIntInRange(form.lowStockThreshold, 0, MAX_STOCK_QTY)
  if (lowStockThreshold == null) errors.lowStockThreshold = AS.settings.inventoryInvalid
  const newBadgeDays = toIntInRange(form.newBadgeDays, 0, 3650)
  if (newBadgeDays == null) errors.newBadgeDays = AS.settings.inventoryInvalid
  const email = form.supportEmail.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.supportEmail = AS.settings.emailInvalid
  if (form.installmentsMode === 'custom' && form.installments.length === 0) errors.installments = AS.settings.installmentsInvalid
  if (Object.keys(errors).length) return { errors, parsed: null }
  return {
    errors,
    parsed: {
      percent: percent!,
      minSubtotal: minSubtotal ?? null,
      usageLimit,
      shippingAmount: shippingAmount ?? null,
      freeOver: freeOver ?? null,
      offerDelay: offerDelay!,
      lowStockThreshold: lowStockThreshold!,
      newBadgeDays: newBadgeDays!,
      installments: form.installmentsMode === 'custom' ? [...form.installments].sort((a, b) => a - b) : null,
    },
  }
}

function countChanges(a: SettingsForm, b: SettingsForm): number {
  return (Object.keys(a) as (keyof SettingsForm)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).length
}

/** `/admin/ayarlar` — marka, kargo, üyelik indirimi, stok/rozet, ödeme/taksit, destek ve sosyal medya. */
export function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(buildInitialForm)
  const [baseline, setBaseline] = useState<SettingsForm>(buildInitialForm)
  const [errors, setErrors] = useState<Errors>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(!useApiMode)
  const [pending, setPending] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const toast = useToast()

  // Herkese açık `GET /settings` beyaz listeli bir alt küme döner; panel gerçek değerleri `GET /admin/settings`'ten alır.
  useEffect(() => {
    if (!useApiMode) return
    let cancelled = false
    getAdminSettings()
      .then((raw) => {
        if (cancelled) return
        const fresh = buildFormFromAdminSettings(raw)
        setForm(fresh)
        setBaseline(fresh)
        setLoadError(null)
        setLoaded(true)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(apiErrorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const changes = useMemo(() => countChanges(form, baseline), [form, baseline])
  const dirty = changes > 0

  function set<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function handleSave() {
    const { errors: errs, parsed } = validate(form)
    setErrors(errs)
    if (!parsed) {
      toast.error(AS.apiNotice.validation)
      return
    }
    if (useApiMode) {
      setPending(true)
      try {
        // PUT her anahtarın değerini BÜTÜNÜYLE değiştirir → memberDiscount ve social her zaman tam gönderilir.
        const saved = await updateAdminSettings({
          'brand.name': form.brandName.trim() || siteSettings.brand.name,
          'brand.shortName': form.brandShortName.trim() || siteSettings.brand.shortName,
          memberDiscount: {
            enabled: form.discountEnabled,
            percent: parsed.percent,
            mode: form.discountMode,
            code: form.discountMode === 'code' ? toNullableString(form.discountCode) : null,
            minSubtotal: parsed.minSubtotal,
            usageLimit: parsed.usageLimit,
            expiresAt: toNullableString(form.discountExpiresAt),
            firstOrderOnly: form.discountFirstOrderOnly,
          },
          'shipping.amount': parsed.shippingAmount,
          'shipping.freeOver': parsed.freeOver,
          'payment.installments': parsed.installments,
          'support.whatsappNumber': toNullableString(form.whatsapp),
          'support.email': toNullableString(form.supportEmail),
          social: { instagram: toNullableString(form.instagram), tiktok: toNullableString(form.tiktok), pinterest: toNullableString(form.pinterest) },
          'offerPanel.delayAfterConsentMs': parsed.offerDelay,
          'inventory.lowStockThreshold': parsed.lowStockThreshold,
          'catalog.newBadgeDays': parsed.newBadgeDays,
        })
        const fresh = buildFormFromAdminSettings(saved)
        setForm(fresh)
        setBaseline(fresh)
        toast.success(AS.apiNotice.saved)
      } catch (e) {
        toast.error(apiErrorMessage(e))
      } finally {
        setPending(false)
      }
      return
    }
    updateAdminData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        brand: { name: form.brandName.trim() || undefined, shortName: form.brandShortName.trim() || undefined },
        memberDiscount: {
          enabled: form.discountEnabled,
          percent: parsed.percent,
          mode: form.discountMode,
          code: toNullableString(form.discountCode),
          minSubtotal: parsed.minSubtotal,
          usageLimit: parsed.usageLimit,
          expiresAt: toNullableString(form.discountExpiresAt),
          firstOrderOnly: form.discountFirstOrderOnly,
        },
        shipping: { amount: parsed.shippingAmount, freeOver: parsed.freeOver },
        payment: parsed.installments ? { installments: parsed.installments } : undefined,
        support: { whatsappNumber: toNullableString(form.whatsapp), email: toNullableString(form.supportEmail) },
        social: { instagram: toNullableString(form.instagram), tiktok: toNullableString(form.tiktok), pinterest: toNullableString(form.pinterest) },
        offerPanel: { delayAfterConsentMs: parsed.offerDelay },
        inventory: { lowStockThreshold: parsed.lowStockThreshold },
        catalog: { newBadgeDays: parsed.newBadgeDays },
      },
    }))
    setBaseline(form)
    toast.success(AS.save.savedLocal)
  }

  if (loadError && !loaded) {
    return (
      <>
        <PageHeader title={AS.settings.title} description={AS.settings.subtitle} />
        <ErrorState message={loadError} onRetry={() => setReloadToken((t) => t + 1)} />
      </>
    )
  }

  const provider = siteSettings.payment.provider
  const disabled = !loaded

  return (
    <div style={{ maxWidth: 880 }}>
      <PageHeader title={AS.settings.title} description={AS.settings.subtitle} />
      {useApiMode ? null : <Notice tone="warning">{AS.demoNotice}</Notice>}

      <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} aria-busy={disabled || undefined}>
        <FormSection id="set-brand" title={AS.settings.brandTitle} description={AS.settings.brandDesc}>
          <div className={ui.formGrid}>
            <TextField label={AS.settings.brandNameLabel} value={form.brandName} maxLength={120} onChange={(e) => set('brandName', e.target.value)} />
            <TextField label={AS.settings.brandShortNameLabel} hint={AS.settings.brandShortNameHint} value={form.brandShortName} maxLength={60} onChange={(e) => set('brandShortName', e.target.value)} />
          </div>
        </FormSection>

        <FormSection id="set-shipping" title={AS.settings.shippingTitle} description={AS.settings.shippingDesc}>
          <div className={ui.formGrid}>
            <TextField
              label={AS.settings.shippingAmountLabel}
              hint={AS.settings.shippingAmountHint}
              inputMode="decimal"
              suffix="TL"
              value={form.shippingAmount}
              error={errors.shippingAmount}
              onChange={(e) => set('shippingAmount', e.target.value)}
            />
            <TextField
              label={AS.settings.freeOverLabel}
              hint={AS.settings.freeOverHint}
              inputMode="decimal"
              suffix="TL"
              value={form.shippingFreeOver}
              error={errors.shippingFreeOver}
              onChange={(e) => set('shippingFreeOver', e.target.value)}
            />
          </div>
        </FormSection>

        <FormSection
          id="set-discount"
          title={AS.settings.discountTitle}
          description={AS.settings.discountDesc}
          actions={<StatusBadge tone={form.discountEnabled ? 'success' : 'neutral'}>{form.discountEnabled ? AS.coupons.statusActive : AS.coupons.statusInactive}</StatusBadge>}
        >
          <div className={ui.stack}>
            <SwitchField label={AS.settings.discountEnabledLabel} checked={form.discountEnabled} onChange={(e) => set('discountEnabled', e.target.checked)} />
            <div className={ui.formGrid}>
              <TextField
                label={AS.settings.discountPercentLabel}
                inputMode="decimal"
                suffix="%"
                value={form.discountPercent}
                error={errors.discountPercent}
                onChange={(e) => set('discountPercent', e.target.value)}
              />
              <SelectField label={AS.settings.discountModeLabel} value={form.discountMode} onChange={(e) => set('discountMode', e.target.value as SettingsForm['discountMode'])}>
                <option value="automatic">{AS.settings.discountModeAutomatic}</option>
                <option value="code">{AS.settings.discountModeCode}</option>
              </SelectField>
              {form.discountMode === 'code' ? (
                <TextField
                  label={AS.settings.discountCodeLabel}
                  hint={AS.settings.discountCodeHint}
                  value={form.discountCode}
                  maxLength={64}
                  onChange={(e) => set('discountCode', e.target.value.toUpperCase())}
                />
              ) : null}
              <TextField
                label={AS.settings.discountMinSubtotalLabel}
                hint={AS.settings.emptyMeansNone}
                inputMode="decimal"
                suffix="TL"
                value={form.discountMinSubtotal}
                error={errors.discountMinSubtotal}
                onChange={(e) => set('discountMinSubtotal', e.target.value)}
              />
              <TextField
                label={AS.settings.discountUsageLimitLabel}
                hint={AS.settings.emptyMeansNone}
                inputMode="numeric"
                value={form.discountUsageLimit}
                error={errors.discountUsageLimit}
                onChange={(e) => set('discountUsageLimit', e.target.value)}
              />
              <TextField label={AS.settings.discountExpiresAtLabel} hint={AS.settings.emptyMeansNone} type="date" value={form.discountExpiresAt} onChange={(e) => set('discountExpiresAt', e.target.value)} />
            </div>
            <CheckField
              label={AS.settings.discountFirstOrderOnlyLabel}
              hint={AS.settings.discountFirstOrderOnlyHint}
              checked={form.discountFirstOrderOnly}
              onChange={(e) => set('discountFirstOrderOnly', e.target.checked)}
            />
          </div>
        </FormSection>

        <FormSection id="set-inventory" title={AS.settings.inventoryTitle} description={AS.settings.inventoryDesc}>
          <div className={ui.formGrid}>
            <TextField
              label={AS.settings.lowStockThresholdLabel}
              hint={AS.settings.lowStockThresholdHint}
              inputMode="numeric"
              suffix="adet"
              value={form.lowStockThreshold}
              error={errors.lowStockThreshold}
              onChange={(e) => set('lowStockThreshold', e.target.value)}
            />
            <TextField
              label={AS.settings.newBadgeDaysLabel}
              hint={AS.settings.newBadgeDaysHint}
              inputMode="numeric"
              suffix="gün"
              value={form.newBadgeDays}
              error={errors.newBadgeDays}
              onChange={(e) => set('newBadgeDays', e.target.value)}
            />
          </div>
        </FormSection>

        <FormSection id="set-payment" title={AS.settings.paymentTitle} description={AS.settings.paymentDesc}>
          <div className={ui.stack}>
            <div className={ui.row}>
              <span className={ui.muted}>{AS.settings.paymentProvider}:</span>
              <StatusBadge tone={provider === 'none' ? 'neutral' : 'success'}>{AS.settings.providerNames[provider] ?? provider}</StatusBadge>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className={ui.label} style={{ marginBottom: 8 }}>
                {AS.settings.installmentsLabel}
              </legend>
              <div className={ui.stackSm}>
                <label className={ui.check}>
                  <input type="radio" name="inst-mode" checked={form.installmentsMode === 'default'} onChange={() => set('installmentsMode', 'default')} />
                  <span>
                    {AS.settings.installmentsDefault}
                    <span className={ui.checkHint}>{AS.settings.installmentsDefaultHint}</span>
                  </span>
                </label>
                <label className={ui.check}>
                  <input type="radio" name="inst-mode" checked={form.installmentsMode === 'custom'} onChange={() => set('installmentsMode', 'custom')} />
                  <span>{AS.settings.installmentsCustom}</span>
                </label>
                {form.installmentsMode === 'custom' ? (
                  <div className={ui.row} style={{ gap: 16, paddingLeft: 24 }} role="group" aria-label={AS.settings.installmentsLabel}>
                    {INSTALLMENT_OPTIONS.map((n) => (
                      <CheckField
                        key={n}
                        label={AS.settings.installmentOption(n)}
                        checked={form.installments.includes(n)}
                        onChange={(e) => set('installments', e.target.checked ? [...form.installments, n].sort((a, b) => a - b) : form.installments.filter((x) => x !== n))}
                      />
                    ))}
                  </div>
                ) : null}
                {errors.installments ? (
                  <p className={ui.error} role="alert">
                    {errors.installments}
                  </p>
                ) : null}
                <p className={ui.hint}>{AS.settings.installmentsHint}</p>
              </div>
            </fieldset>
          </div>
        </FormSection>

        <FormSection id="set-support" title={AS.settings.supportTitle} description={AS.settings.supportDesc}>
          <div className={ui.formGrid}>
            <TextField label={AS.settings.whatsappLabel} hint={AS.settings.whatsappHint} inputMode="tel" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
            <TextField label={AS.settings.emailLabel} type="email" value={form.supportEmail} error={errors.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} />
            <TextField label={AS.settings.instagramLabel} hint={AS.settings.socialHint} type="url" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} />
            <TextField label={AS.settings.tiktokLabel} type="url" value={form.tiktok} onChange={(e) => set('tiktok', e.target.value)} />
            <TextField label={AS.settings.pinterestLabel} type="url" value={form.pinterest} onChange={(e) => set('pinterest', e.target.value)} />
          </div>
        </FormSection>

        <FormSection id="set-offer" title={AS.settings.offerTitle} description={AS.settings.offerDesc}>
          <div className={ui.formGrid}>
            <TextField
              label={AS.settings.offerDelayLabel}
              hint={AS.settings.offerDelayHint}
              inputMode="numeric"
              suffix="ms"
              value={form.offerDelayMs}
              error={errors.offerDelayMs}
              onChange={(e) => set('offerDelayMs', e.target.value)}
            />
          </div>
        </FormSection>
      </fieldset>

      <StickySaveBar
        dirty={dirty}
        saving={pending}
        changes={changes}
        onSave={() => void handleSave()}
        onDiscard={() => {
          setForm(baseline)
          setErrors({})
          toast.info(AS.save.discarded)
        }}
      />
    </div>
  )
}
