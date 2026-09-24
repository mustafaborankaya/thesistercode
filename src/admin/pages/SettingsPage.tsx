import { useEffect, useState } from 'react'
import { Field, SelectField, Switch } from '../../components/ui/Field'
import { defaultSettings, siteSettings } from '../../config/settings'
import { brandMedia, brandMediaNames } from '../../data/media'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { getAdminContent, getAdminSettings, updateAdminBrandMedia, updateAdminSettings, useApiMode } from '../adminApi'
import { updateAdminData } from '../adminStore'
import { AS } from '../adminStrings'
import { ApiMediaField } from '../components/ApiMediaField'
import { MediaField } from '../components/MediaField'
import { SaveBar } from '../components/SaveBar'
import styles from '../admin.module.css'

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
  shippingAmount: string
  whatsapp: string
  supportEmail: string
  instagram: string
  tiktok: string
  pinterest: string
  offerDelayMs: string
}

function buildInitialForm(): SettingsForm {
  const s = siteSettings
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
    shippingAmount: s.shipping.amount == null ? '' : String(s.shipping.amount),
    whatsapp: s.support.whatsappNumber ?? '',
    supportEmail: s.support.email ?? '',
    instagram: s.social.instagram ?? '',
    tiktok: s.social.tiktok ?? '',
    pinterest: s.social.pinterest ?? '',
    offerDelayMs: String(s.offerPanel.delayAfterConsentMs),
  }
}

/**
 * Yönetici `GET /admin/settings` yanıtından form doldurur — herkese açık `GET /settings` artık beyaz
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
    shippingAmount: typeof shippingAmount === 'number' ? String(shippingAmount) : '',
    whatsapp: typeof raw['support.whatsappNumber'] === 'string' ? (raw['support.whatsappNumber'] as string) : '',
    supportEmail: typeof raw['support.email'] === 'string' ? (raw['support.email'] as string) : '',
    instagram: social.instagram ?? '',
    tiktok: social.tiktok ?? '',
    pinterest: social.pinterest ?? '',
    offerDelayMs: String(typeof offerDelay === 'number' ? offerDelay : defaultSettings.offerPanel.delayAfterConsentMs),
  }
}

function toNullableNumber(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function toNullableString(v: string): string | null {
  const t = v.trim()
  return t ? t : null
}

const mediaFields: { key: keyof typeof brandMediaNames; ratio: string; kind: 'image' | 'video'; accept: string }[] = [
  { key: 'logo', ratio: '1 / 1', kind: 'image', accept: 'image/*' },
  { key: 'heroDesktop', ratio: '1440 / 560', kind: 'image', accept: 'image/*' },
  { key: 'heroMobile', ratio: '780 / 840', kind: 'image', accept: 'image/*' },
  { key: 'collection', ratio: '16 / 10', kind: 'image', accept: 'image/*' },
  { key: 'auth', ratio: '3 / 4', kind: 'image', accept: 'image/*' },
  { key: 'productionVideo', ratio: '16 / 9', kind: 'video', accept: 'video/mp4,video/webm' },
  { key: 'productionVideoPoster', ratio: '16 / 9', kind: 'image', accept: 'image/*' },
  { key: 'productionCutting', ratio: '4 / 5', kind: 'image', accept: 'image/*' },
  { key: 'productionSewing', ratio: '4 / 5', kind: 'image', accept: 'image/*' },
  { key: 'productionQuality', ratio: '4 / 5', kind: 'image', accept: 'image/*' },
]

/** `/admin/ayarlar` — marka, kampanya, kargo, destek, sosyal, teklif paneli ve marka görselleri. */
export function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(buildInitialForm)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // API modunda marka görsellerinin en son yüklenen URL'leri. `data/media.ts`'teki `brandMedia` yalnızca
  // AÇILIŞ ANI anlık görüntüsüdür — sayfa yeniden monte edildiğinde (başka sayfaya gidip geri dönünce)
  // güncel olmayabilir, bu yüzden aşağıdaki useEffect'te `GET /admin/content`'ten taze doldurulur.
  const [mediaOverrides, setMediaOverrides] = useState<Partial<Record<keyof typeof brandMediaNames, string | null>>>({})

  // Herkese açık `GET /settings` beyaz listeli bir alt küme döner (bkz. buildFormFromAdminSettings);
  // panel için gerçek değerler `GET /admin/settings`'ten ayrıca yüklenir. Marka görselleri de aynı
  // nedenle (taze veri) `GET /admin/content`'ten ayrıca yüklenir.
  useEffect(() => {
    if (!useApiMode) return
    getAdminSettings()
      .then((raw) => setForm(buildFormFromAdminSettings(raw)))
      .catch((e) => setError(apiErrorMessage(e)))
    getAdminContent()
      .then((content) => {
        const fresh: Partial<Record<keyof typeof brandMediaNames, string | null>> = {}
        for (const key of Object.keys(brandMediaNames) as (keyof typeof brandMediaNames)[]) {
          const name = brandMediaNames[key]
          if (name in content.brandMedia) fresh[key] = content.brandMedia[name]
        }
        setMediaOverrides(fresh)
      })
      .catch((e) => setError(apiErrorMessage(e)))
  }, [])

  function set<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setMessage(null)
  }

  async function handleSave() {
    if (useApiMode) {
      setPending(true)
      setError(null)
      try {
        await updateAdminSettings({
          'brand.name': form.brandName.trim() || siteSettings.brand.name,
          'brand.shortName': form.brandShortName.trim() || siteSettings.brand.shortName,
          memberDiscount: {
            enabled: form.discountEnabled,
            percent: toNullableNumber(form.discountPercent) ?? 0,
            mode: form.discountMode,
            code: form.discountMode === 'code' ? toNullableString(form.discountCode) : null,
            minSubtotal: toNullableNumber(form.discountMinSubtotal),
            usageLimit: toNullableNumber(form.discountUsageLimit),
            expiresAt: toNullableString(form.discountExpiresAt),
          },
          'shipping.amount': toNullableNumber(form.shippingAmount),
          'support.whatsappNumber': toNullableString(form.whatsapp),
          'support.email': toNullableString(form.supportEmail),
          social: { instagram: toNullableString(form.instagram), tiktok: toNullableString(form.tiktok), pinterest: toNullableString(form.pinterest) },
          'offerPanel.delayAfterConsentMs': toNullableNumber(form.offerDelayMs) ?? siteSettings.offerPanel.delayAfterConsentMs,
        })
        setMessage(AS.apiNotice.saved)
      } catch (e) {
        setError(apiErrorMessage(e))
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
          percent: toNullableNumber(form.discountPercent) ?? undefined,
          mode: form.discountMode,
          code: toNullableString(form.discountCode),
          minSubtotal: toNullableNumber(form.discountMinSubtotal),
          usageLimit: toNullableNumber(form.discountUsageLimit),
          expiresAt: toNullableString(form.discountExpiresAt),
        },
        shipping: { amount: toNullableNumber(form.shippingAmount) },
        support: { whatsappNumber: toNullableString(form.whatsapp), email: toNullableString(form.supportEmail) },
        social: { instagram: toNullableString(form.instagram), tiktok: toNullableString(form.tiktok), pinterest: toNullableString(form.pinterest) },
        offerPanel: { delayAfterConsentMs: toNullableNumber(form.offerDelayMs) ?? undefined },
      },
    }))
    setMessage(AS.save.saved)
  }

  // Hata olursa ApiMediaField kendi alanının yanında gösterir (throw edilir); burada yalnızca başarı işlenir.
  async function handleBrandMediaUpload(key: keyof typeof brandMediaNames, url: string | null) {
    await updateAdminBrandMedia({ [brandMediaNames[key]]: url })
    setMediaOverrides((m) => ({ ...m, [key]: url }))
    setMessage(AS.apiNotice.saved)
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.settings.title}</h1>
      </div>
      {useApiMode ? null : <p className={styles.demoNotice}>{AS.demoNotice}</p>}
      {error ? (
        <p className={styles.empty} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.settings.brandTitle}</div>
        <div className={styles.grid}>
          <Field label={AS.settings.brandNameLabel} value={form.brandName} onChange={(e) => set('brandName', e.target.value)} />
          <Field label={AS.settings.brandShortNameLabel} value={form.brandShortName} onChange={(e) => set('brandShortName', e.target.value)} />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.settings.discountTitle}</div>
        <Switch label={AS.settings.discountEnabledLabel} checked={form.discountEnabled} onChange={(e) => set('discountEnabled', e.target.checked)} />
        <div className={styles.grid} style={{ marginTop: 'var(--sp-4)' }}>
          <Field label={AS.settings.discountPercentLabel} type="number" min={0} max={100} value={form.discountPercent} onChange={(e) => set('discountPercent', e.target.value)} />
          <SelectField label={AS.settings.discountModeLabel} value={form.discountMode} onChange={(e) => set('discountMode', e.target.value as SettingsForm['discountMode'])}>
            <option value="automatic">{AS.settings.discountModeAutomatic}</option>
            <option value="code">{AS.settings.discountModeCode}</option>
          </SelectField>
          <Field label={AS.settings.discountCodeLabel} value={form.discountCode} onChange={(e) => set('discountCode', e.target.value)} disabled={form.discountMode !== 'code'} />
          <Field label={AS.settings.discountMinSubtotalLabel} type="number" min={0} value={form.discountMinSubtotal} onChange={(e) => set('discountMinSubtotal', e.target.value)} />
          <Field label={AS.settings.discountUsageLimitLabel} type="number" min={0} value={form.discountUsageLimit} onChange={(e) => set('discountUsageLimit', e.target.value)} />
          <Field label={AS.settings.discountExpiresAtLabel} type="date" value={form.discountExpiresAt} onChange={(e) => set('discountExpiresAt', e.target.value)} />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.settings.shippingTitle}</div>
        <div className={styles.grid}>
          <Field label={AS.settings.shippingAmountLabel} type="number" min={0} value={form.shippingAmount} onChange={(e) => set('shippingAmount', e.target.value)} />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.settings.supportTitle}</div>
        <div className={styles.grid}>
          <Field label={AS.settings.whatsappLabel} value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
          <Field label={AS.settings.emailLabel} type="email" value={form.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.settings.socialTitle}</div>
        <div className={styles.grid}>
          <Field label={AS.settings.instagramLabel} value={form.instagram} onChange={(e) => set('instagram', e.target.value)} />
          <Field label={AS.settings.tiktokLabel} value={form.tiktok} onChange={(e) => set('tiktok', e.target.value)} />
          <Field label={AS.settings.pinterestLabel} value={form.pinterest} onChange={(e) => set('pinterest', e.target.value)} />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.settings.offerTitle}</div>
        <div className={styles.grid}>
          <Field label={AS.settings.offerDelayLabel} type="number" min={0} value={form.offerDelayMs} onChange={(e) => set('offerDelayMs', e.target.value)} />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.settings.mediaTitle}</div>
        <div className={styles.mediaGrid}>
          {useApiMode
            ? mediaFields.map((m) => {
                const override = mediaOverrides[m.key]
                const src = override !== undefined ? override : brandMedia[m.key]
                return (
                  <ApiMediaField
                    key={m.key}
                    name={brandMediaNames[m.key]}
                    label={AS.settings.mediaLabels[m.key]}
                    src={src}
                    ratio={m.ratio}
                    kind={m.kind}
                    accept={m.accept}
                    onUpload={(url) => handleBrandMediaUpload(m.key, url)}
                    onRemove={() => handleBrandMediaUpload(m.key, null)}
                  />
                )
              })
            : mediaFields.map((m) => (
                <MediaField
                  key={m.key}
                  name={brandMediaNames[m.key]}
                  label={AS.settings.mediaLabels[m.key]}
                  ratio={m.ratio}
                  kind={m.kind}
                  accept={m.accept}
                  onChange={() => setMessage(AS.save.saved)}
                />
              ))}
        </div>
      </div>

      <SaveBar onSave={() => void handleSave()} message={message} pending={pending} />
    </div>
  )
}
