import { useEffect, useState } from 'react'
import { AccordionItem } from '../../components/ui/Accordion'
import { TextareaField } from '../../components/ui/Field'
import { brandContent, brandContentKeys, contentDefaultsEn, cookieContent, infoPages, productionContent, sizeGuideContent, type BrandContentKey } from '../../data/content'
import { contentTexts, infoSectionTexts } from '../../data/contentTexts'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { getAdminContent, updateAdminContentFields, useApiMode, type AdminContent } from '../adminApi'
import { readAdminData, updateAdminData } from '../adminStore'
import { AS } from '../adminStrings'
import { SaveBar } from '../components/SaveBar'
import styles from '../admin.module.css'

const productionStepIds = ['kesim', 'dikim', 'kalite'] as const
type ProductionStepId = (typeof productionStepIds)[number]

interface ContentForm {
  brand: Record<BrandContentKey, string>
  infoPages: Record<string, string[]>
  cookieText: string
  cookieCategories: { necessary: string; analytics: string; marketing: string }
  production: { intro: string; steps: Record<ProductionStepId, { title: string; text: string }> }
  sizeGuide: { table: string; note: string }
}

/** SSS alanları mağazada akordeon olarak ayrıştırılır (src/components/info/parseFaq.ts). */
const SSS_FORMAT_HINT = 'Biçim: soru satırı "S:", cevap satırı "C:" ile başlar (EN alanında "Q:" / "A:"). Cevap birden çok satır olabilir; soruları boş satırla ayırabilirsiniz.'

const editableInfoPages = infoPages.filter((p) => p.slug !== 'iletisim')

function buildInitialForm(): ContentForm {
  const stepById = Object.fromEntries(productionContent.steps.map((s) => [s.id, s]))
  return {
    brand: Object.fromEntries(brandContentKeys.map((k) => [k, brandContent[k].value ?? ''])) as Record<BrandContentKey, string>,
    infoPages: Object.fromEntries(editableInfoPages.map((p) => [p.slug, p.sections.map((s) => s.value ?? '')])),
    cookieText: cookieContent.bannerText.value ?? '',
    cookieCategories: {
      necessary: cookieContent.categories.find((c) => c.id === 'necessary')?.description.value ?? '',
      analytics: cookieContent.categories.find((c) => c.id === 'analytics')?.description.value ?? '',
      marketing: cookieContent.categories.find((c) => c.id === 'marketing')?.description.value ?? '',
    },
    production: {
      intro: productionContent.intro.value ?? '',
      steps: {
        kesim: { title: stepById.kesim?.title.value ?? '', text: stepById.kesim?.text.value ?? '' },
        dikim: { title: stepById.dikim?.title.value ?? '', text: stepById.dikim?.text.value ?? '' },
        kalite: { title: stepById.kalite?.title.value ?? '', text: stepById.kalite?.text.value ?? '' },
      },
    },
    sizeGuide: { table: sizeGuideContent.table.value ?? '', note: sizeGuideContent.note.value ?? '' },
  }
}

/** ContentForm'u API alan anahtarlarına (bkz. api/seed/content.json) düzleştirir — hem patch üretimi hem taban karşılaştırması için ortak kullanılır. */
function flattenForm(form: ContentForm): Record<string, string> {
  const flat: Record<string, string> = {
    'brand.collectionTitle': form.brand.collectionTitle,
    'brand.collectionIntro': form.brand.collectionIntro,
    'brand.companyName': form.brand.companyName,
    'brand.address': form.brand.address,
    'brand.phone': form.brand.phone,
    'brand.email': form.brand.email,
    'brand.workingHours': form.brand.workingHours,
    'cookie.bannerText': form.cookieText,
    'cookie.necessary': form.cookieCategories.necessary,
    'cookie.analytics': form.cookieCategories.analytics,
    'cookie.marketing': form.cookieCategories.marketing,
    'production.intro': form.production.intro,
    'production.kesim.title': form.production.steps.kesim.title,
    'production.kesim.text': form.production.steps.kesim.text,
    'production.dikim.title': form.production.steps.dikim.title,
    'production.dikim.text': form.production.steps.dikim.text,
    'production.kalite.title': form.production.steps.kalite.title,
    'production.kalite.text': form.production.steps.kalite.text,
    'sizeGuide.table': form.sizeGuide.table,
    'sizeGuide.note': form.sizeGuide.note,
  }
  for (const [slug, sections] of Object.entries(form.infoPages)) {
    sections.forEach((value, i) => {
      flat[`info.${slug}.${i}`] = value
    })
  }
  return flat
}

/**
 * `form` ile `baseline` (son yüklenen/kaydedilen durum) arasındaki FARKI üretir — yalnızca gerçekten
 * değişen alanlar gönderilir. Bunun aksi (her zaman tüm alanları göndermek) `contentTexts.ts`'teki
 * yer tutucu varsayılan metinleri hiç dokunulmamış alanlara bile gerçek içerikmiş gibi DB'ye yazardı.
 */
function buildFieldsPatch(form: ContentForm, baseline: ContentForm): Record<string, string | null> {
  const current = flattenForm(form)
  const before = flattenForm(baseline)
  const patch: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(current)) {
    const trimmed = value.trim()
    if (trimmed === before[key].trim()) continue
    patch[key] = trimmed ? trimmed : null
  }
  return patch
}

const clean = (v: string | null | undefined): string | null => (v && v.trim() ? v : null)

/* ---------------- İngilizce (EN) alanlar ---------------- */

/** EN formu: API alan anahtarı → metin (TR formuyla aynı anahtar kümesi, bkz. flattenForm). */
type EnForm = Record<string, string>

const contentKeys = Object.keys(flattenForm(buildInitialForm()))

/** EN değeri: API `fieldsEn` (taze) > yönetici paneli localStorage EN override'ı > hazır İngilizce metin > boş. */
function buildEnForm(fieldsEn: Record<string, string>): EnForm {
  const local = readAdminData().content.en ?? {}
  return Object.fromEntries(contentKeys.map((key) => [key, clean(fieldsEn[key]) ?? clean(local[key]) ?? contentDefaultsEn[key] ?? '']))
}

/** EN için buildFieldsPatch'in aynısı: yalnızca değişen anahtarlar; boş → null (EN değerini temizler). */
function buildEnPatch(en: EnForm, baseline: EnForm): Record<string, string | null> {
  const patch: Record<string, string | null> = {}
  for (const key of contentKeys) {
    const trimmed = (en[key] ?? '').trim()
    if (trimmed === (baseline[key] ?? '').trim()) continue
    patch[key] = trimmed ? trimmed : null
  }
  return patch
}

const initialEnForm = (): EnForm => buildEnForm({})

/** Tek bir alan için değer çözümler: API (taze) > yönetici paneli localStorage override'ı > contentTexts.ts metni > boş. */
function resolveField(fresh: string | null | undefined, local: string | null | undefined, fallback: string | undefined): string {
  return clean(fresh) ?? clean(local) ?? fallback ?? ''
}

/**
 * `GET /admin/content`'in TAZE yanıtından formu yeniden kurar (bkz. api/README.md). ContentPage
 * yeniden monte edildiğinde (örn. başka sayfaya gidip geri dönünce) `data/content.ts`'in AÇILIŞ ANI
 * anlık görüntüsü artık güncel olmayabilir — bu fonksiyon aynı öncelik zincirini taze veriyle uygular.
 */
function buildFormFromFields(fields: Record<string, string | null>): ContentForm {
  const overrides = readAdminData().content
  const b = overrides.brand ?? {}
  const p = overrides.production ?? {}
  const cc = overrides.cookieCategories ?? {}
  return {
    brand: {
      collectionTitle: resolveField(fields['brand.collectionTitle'], b.collectionTitle, contentTexts['brand.collectionTitle']),
      collectionIntro: resolveField(fields['brand.collectionIntro'], b.collectionIntro, contentTexts['brand.collectionIntro']),
      companyName: resolveField(fields['brand.companyName'], b.companyName, contentTexts['brand.companyName']),
      address: resolveField(fields['brand.address'], b.address, contentTexts['brand.address']),
      phone: resolveField(fields['brand.phone'], b.phone, contentTexts['brand.phone']),
      email: resolveField(fields['brand.email'], b.email, contentTexts['brand.email']),
      workingHours: resolveField(fields['brand.workingHours'], b.workingHours, contentTexts['brand.workingHours']),
    },
    infoPages: Object.fromEntries(
      editableInfoPages.map((page) => [
        page.slug,
        page.sections.map((_, i) => resolveField(fields[`info.${page.slug}.${i}`], overrides.infoPages?.[page.slug]?.[i], infoSectionTexts[page.slug]?.[i])),
      ]),
    ),
    cookieText: resolveField(fields['cookie.bannerText'], overrides.cookieText, contentTexts['cookie.bannerText']),
    cookieCategories: {
      necessary: resolveField(fields['cookie.necessary'], cc.necessary, contentTexts['cookie.necessary']),
      analytics: resolveField(fields['cookie.analytics'], cc.analytics, contentTexts['cookie.analytics']),
      marketing: resolveField(fields['cookie.marketing'], cc.marketing, contentTexts['cookie.marketing']),
    },
    production: {
      intro: resolveField(fields['production.intro'], p.intro, contentTexts['production.intro']),
      steps: {
        kesim: {
          title: resolveField(fields['production.kesim.title'], p.steps?.kesim?.title, contentTexts['production.kesim.title']),
          text: resolveField(fields['production.kesim.text'], p.steps?.kesim?.text, contentTexts['production.kesim.text']),
        },
        dikim: {
          title: resolveField(fields['production.dikim.title'], p.steps?.dikim?.title, contentTexts['production.dikim.title']),
          text: resolveField(fields['production.dikim.text'], p.steps?.dikim?.text, contentTexts['production.dikim.text']),
        },
        kalite: {
          title: resolveField(fields['production.kalite.title'], p.steps?.kalite?.title, contentTexts['production.kalite.title']),
          text: resolveField(fields['production.kalite.text'], p.steps?.kalite?.text, contentTexts['production.kalite.text']),
        },
      },
    },
    sizeGuide: {
      table: resolveField(fields['sizeGuide.table'], overrides.sizeGuide?.table, contentTexts['sizeGuide.table']),
      note: resolveField(fields['sizeGuide.note'], overrides.sizeGuide?.note, contentTexts['sizeGuide.note']),
    },
  }
}

/** `/admin/icerik` — marka bilgileri, bilgi sayfaları, çerez metinleri, üretim, beden rehberi. */
export function ContentPage() {
  const [form, setForm] = useState<ContentForm>(buildInitialForm)
  // Kaydetme anında yalnızca gerçekten DEĞİŞEN alanları göndermek için taban — bkz. buildFieldsPatch.
  const [baseline, setBaseline] = useState<ContentForm>(buildInitialForm)
  const [enForm, setEnForm] = useState<EnForm>(initialEnForm)
  const [enBaseline, setEnBaseline] = useState<EnForm>(initialEnForm)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  /** TR alanının hemen altında gösterilen İngilizce alan (`key`: API alan anahtarı). */
  function enField(key: string, label: string, rows: number) {
    return (
      <TextareaField
        key={`${key}-en`}
        label={AS.content.enLabel(label)}
        lang="en"
        rows={rows}
        placeholder={AS.content.enPlaceholder}
        value={enForm[key] ?? ''}
        onChange={(e) => {
          const value = e.target.value
          setEnForm((f) => ({ ...f, [key]: value }))
          setMessage(null)
        }}
      />
    )
  }

  // `data/content.ts`'in modül yüklenirken aldığı anlık görüntü, sayfa yeniden monte edildiğinde
  // (başka panel sayfasına gidip geri dönünce) artık güncel olmayabilir — API modunda her montajda
  // taze veri çekilir (bkz. buildFormFromFields).
  useEffect(() => {
    if (!useApiMode) return
    let cancelled = false
    getAdminContent()
      .then((content: AdminContent) => {
        if (cancelled) return
        const fresh = buildFormFromFields(content.fields)
        setForm(fresh)
        setBaseline(fresh)
        const freshEn = buildEnForm(content.fieldsEn)
        setEnForm(freshEn)
        setEnBaseline(freshEn)
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave() {
    if (useApiMode) {
      const patch = buildFieldsPatch(form, baseline)
      const patchEn = buildEnPatch(enForm, enBaseline)
      if (Object.keys(patch).length === 0 && Object.keys(patchEn).length === 0) {
        setMessage(AS.apiNotice.saved)
        return
      }
      setPending(true)
      setError(null)
      try {
        await updateAdminContentFields(patch, patchEn)
        setBaseline(form)
        setEnBaseline(enForm)
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
      content: {
        brand: { ...form.brand },
        infoPages: { ...form.infoPages },
        cookieText: form.cookieText,
        cookieCategories: { ...form.cookieCategories },
        production: {
          intro: form.production.intro,
          steps: {
            kesim: { ...form.production.steps.kesim },
            dikim: { ...form.production.steps.dikim },
            kalite: { ...form.production.steps.kalite },
          },
        },
        sizeGuide: { ...form.sizeGuide },
        // Yalnızca hazır İngilizce metinden FARKLI dolu EN değerleri saklanır (varsayılanı dondurmamak için).
        en: Object.fromEntries(
          contentKeys.map((key) => [key, (enForm[key] ?? '').trim()] as const).filter(([key, value]) => value && value !== (contentDefaultsEn[key] ?? '').trim()),
        ),
      },
    }))
    setMessage(AS.save.saved)
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.content.title}</h1>
      </div>
      {useApiMode ? null : <p className={styles.demoNotice}>{AS.demoNotice}</p>}
      <p className="text-soft text-sm" style={{ marginBottom: 'var(--sp-4)' }}>
        {AS.content.enNote}
      </p>
      {error ? (
        <p className={styles.empty} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.accordionGroup}>
        <AccordionItem title={AS.content.brandTitle} defaultOpen>
          <div className={styles.fieldStack}>
            {brandContentKeys.map((key) => [
              <TextareaField
                key={key}
                label={brandContent[key].label}
                rows={2}
                value={form.brand[key]}
                onChange={(e) => {
                  setForm((f) => ({ ...f, brand: { ...f.brand, [key]: e.target.value } }))
                  setMessage(null)
                }}
              />,
              enField(`brand.${key}`, brandContent[key].label, 2),
            ])}
          </div>
        </AccordionItem>

        <AccordionItem title={AS.content.infoPagesTitle}>
          <p className="text-soft text-sm" style={{ marginBottom: 'var(--sp-4)' }}>
            {AS.content.infoPagesSkipNote}
          </p>
          <div className={styles.accordionGroup}>
            {editableInfoPages.map((page) => (
              <AccordionItem key={page.slug} title={page.title}>
                <div className={styles.fieldStack}>
                  {page.sections.map((section, i) => [
                    <TextareaField
                      key={`${page.slug}-${i}`}
                      label={section.label}
                      rows={page.slug === 'sss' ? 8 : 3}
                      hint={page.slug === 'sss' ? SSS_FORMAT_HINT : undefined}
                      value={form.infoPages[page.slug]?.[i] ?? ''}
                      onChange={(e) => {
                        setForm((f) => {
                          const next = [...(f.infoPages[page.slug] ?? [])]
                          next[i] = e.target.value
                          return { ...f, infoPages: { ...f.infoPages, [page.slug]: next } }
                        })
                        setMessage(null)
                      }}
                    />,
                    enField(`info.${page.slug}.${i}`, section.label, 3),
                  ])}
                </div>
              </AccordionItem>
            ))}
          </div>
        </AccordionItem>

        <AccordionItem title={AS.content.cookieTitle}>
          <div className={styles.fieldStack}>
            <TextareaField
              label={cookieContent.bannerText.label}
              rows={3}
              value={form.cookieText}
              onChange={(e) => {
                setForm((f) => ({ ...f, cookieText: e.target.value }))
                setMessage(null)
              }}
            />
            {enField('cookie.bannerText', cookieContent.bannerText.label, 3)}
            <div className={styles.subCardTitle}>{AS.content.cookieCategoriesTitle}</div>
            {cookieContent.categories.map((c) => [
              <TextareaField
                key={c.id}
                label={c.description.label}
                rows={2}
                value={form.cookieCategories[c.id]}
                onChange={(e) => {
                  const value = e.target.value
                  setForm((f) => ({ ...f, cookieCategories: { ...f.cookieCategories, [c.id]: value } }))
                  setMessage(null)
                }}
              />,
              enField(`cookie.${c.id}`, c.description.label, 2),
            ])}
          </div>
        </AccordionItem>

        <AccordionItem title={AS.content.productionTitle}>
          <div className={styles.fieldStack}>
            <TextareaField
              label={AS.content.productionIntroLabel}
              rows={3}
              value={form.production.intro}
              onChange={(e) => {
                const value = e.target.value
                setForm((f) => ({ ...f, production: { ...f.production, intro: value } }))
                setMessage(null)
              }}
            />
            {enField('production.intro', AS.content.productionIntroLabel, 3)}
            <div className={styles.subCardTitle}>{AS.content.productionStepsTitle}</div>
            {productionContent.steps.map((step) => (
              <div key={step.id} className={styles.subCard}>
                <div className={styles.fieldStack}>
                  <TextareaField
                    label={step.title.label}
                    rows={1}
                    value={form.production.steps[step.id as ProductionStepId].title}
                    onChange={(e) => {
                      const value = e.target.value
                      const id = step.id as ProductionStepId
                      setForm((f) => ({ ...f, production: { ...f.production, steps: { ...f.production.steps, [id]: { ...f.production.steps[id], title: value } } } }))
                      setMessage(null)
                    }}
                  />
                  {enField(`production.${step.id}.title`, step.title.label, 1)}
                  <TextareaField
                    label={step.text.label}
                    rows={3}
                    value={form.production.steps[step.id as ProductionStepId].text}
                    onChange={(e) => {
                      const value = e.target.value
                      const id = step.id as ProductionStepId
                      setForm((f) => ({ ...f, production: { ...f.production, steps: { ...f.production.steps, [id]: { ...f.production.steps[id], text: value } } } }))
                      setMessage(null)
                    }}
                  />
                  {enField(`production.${step.id}.text`, step.text.label, 3)}
                </div>
              </div>
            ))}
          </div>
        </AccordionItem>

        <AccordionItem title={AS.content.sizeGuideTitle}>
          <div className={styles.fieldStack}>
            <TextareaField
              label={sizeGuideContent.table.label}
              rows={4}
              value={form.sizeGuide.table}
              onChange={(e) => {
                const value = e.target.value
                setForm((f) => ({ ...f, sizeGuide: { ...f.sizeGuide, table: value } }))
                setMessage(null)
              }}
            />
            {enField('sizeGuide.table', sizeGuideContent.table.label, 4)}
            <TextareaField
              label={sizeGuideContent.note.label}
              rows={2}
              value={form.sizeGuide.note}
              onChange={(e) => {
                const value = e.target.value
                setForm((f) => ({ ...f, sizeGuide: { ...f.sizeGuide, note: value } }))
                setMessage(null)
              }}
            />
            {enField('sizeGuide.note', sizeGuideContent.note.label, 2)}
          </div>
        </AccordionItem>
      </div>

      <SaveBar onSave={() => void handleSave()} message={message} pending={pending} />
    </div>
  )
}
