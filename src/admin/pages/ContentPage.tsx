import { useState } from 'react'
import { AccordionItem } from '../../components/ui/Accordion'
import { TextareaField } from '../../components/ui/Field'
import { brandContent, brandContentKeys, cookieContent, infoPages, productionContent, sizeGuideContent, type BrandContentKey } from '../../data/content'
import { updateAdminData } from '../adminStore'
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

/** `/admin/icerik` — marka bilgileri, bilgi sayfaları, çerez metinleri, üretim, beden rehberi. */
export function ContentPage() {
  const [form, setForm] = useState<ContentForm>(buildInitialForm)
  const [message, setMessage] = useState<string | null>(null)

  function handleSave() {
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
      },
    }))
    setMessage(AS.save.saved)
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.content.title}</h1>
      </div>
      <p className={styles.demoNotice}>{AS.demoNotice}</p>

      <div className={styles.accordionGroup}>
        <AccordionItem title={AS.content.brandTitle} defaultOpen>
          <div className={styles.fieldStack}>
            {brandContentKeys.map((key) => (
              <TextareaField
                key={key}
                label={brandContent[key].label}
                rows={2}
                value={form.brand[key]}
                onChange={(e) => {
                  setForm((f) => ({ ...f, brand: { ...f.brand, [key]: e.target.value } }))
                  setMessage(null)
                }}
              />
            ))}
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
                  {page.sections.map((section, i) => (
                    <TextareaField
                      key={`${page.slug}-${i}`}
                      label={section.label}
                      rows={3}
                      value={form.infoPages[page.slug]?.[i] ?? ''}
                      onChange={(e) => {
                        setForm((f) => {
                          const next = [...(f.infoPages[page.slug] ?? [])]
                          next[i] = e.target.value
                          return { ...f, infoPages: { ...f.infoPages, [page.slug]: next } }
                        })
                        setMessage(null)
                      }}
                    />
                  ))}
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
            <div className={styles.subCardTitle}>{AS.content.cookieCategoriesTitle}</div>
            {cookieContent.categories.map((c) => (
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
              />
            ))}
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
          </div>
        </AccordionItem>
      </div>

      <SaveBar onSave={handleSave} message={message} />
    </div>
  )
}
