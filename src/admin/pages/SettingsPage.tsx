import { useState } from 'react'
import { Field, SelectField, Switch } from '../../components/ui/Field'
import { siteSettings } from '../../config/settings'
import { brandMediaNames } from '../../data/media'
import { updateAdminData } from '../adminStore'
import { AS } from '../adminStrings'
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

  function set<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setMessage(null)
  }

  function handleSave() {
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

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.settings.title}</h1>
      </div>
      <p className={styles.demoNotice}>{AS.demoNotice}</p>

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
          {mediaFields.map((m) => (
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

      <SaveBar onSave={handleSave} message={message} />
    </div>
  )
}
