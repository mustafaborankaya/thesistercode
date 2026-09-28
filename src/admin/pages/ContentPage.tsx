import { useEffect, useMemo, useState } from 'react'
import { brandContent, brandContentKeys, contentDefaultsEn, cookieContent, infoPages, productionContent, sizeGuideContent, type BrandContentKey } from '../../data/content'
import { contentTexts, infoSectionTexts } from '../../data/contentTexts'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { getAdminContent, updateAdminContentFields, useApiMode, type AdminContent } from '../adminApi'
import { readAdminData, updateAdminData } from '../adminStore'
import { AS } from '../adminStrings'
import { AdminIcon } from '../ui/AdminIcon'
import { Btn } from '../ui/Button'
import { FilterBar } from '../ui/FilterBar'
import { AutoTextarea } from '../ui/Form'
import { EmptyState, ErrorState, Notice, PageHeader } from '../ui/Page'
import { StatusBadge } from '../ui/StatusBadge'
import { StickySaveBar } from '../ui/StickySaveBar'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'
import styles from '../admin.module.css'

const productionStepIds = ['kesim', 'dikim', 'kalite'] as const
type ProductionStepId = (typeof productionStepIds)[number]

/** Düz form: API alan anahtarı (bkz. api/seed/content.json) → metin. TR ve EN aynı anahtar kümesini kullanır. */
type FlatForm = Record<string, string>

const editableInfoPages = infoPages.filter((p) => p.slug !== 'iletisim')
const LEGAL_SLUGS = new Set(['gizlilik', 'cerez-politikasi', 'mesafeli-satis-sozlesmesi', 'teslimat-ve-iade', 'on-bilgilendirme-formu'])

const clean = (v: string | null | undefined): string | null => (v && v.trim() ? v : null)

/** Tek bir alan için değer çözümler: API (taze) > yönetici paneli localStorage override'ı > contentTexts.ts metni > boş. */
function resolveField(fresh: string | null | undefined, local: string | null | undefined, fallback: string | undefined): string {
  return clean(fresh) ?? clean(local) ?? fallback ?? ''
}

/** Açılış anı (data/content.ts) değerlerinden düz TR form. */
function buildInitialForm(): FlatForm {
  const stepById = Object.fromEntries(productionContent.steps.map((s) => [s.id, s]))
  const flat: FlatForm = {}
  for (const k of brandContentKeys) flat[`brand.${k}`] = brandContent[k].value ?? ''
  flat['cookie.bannerText'] = cookieContent.bannerText.value ?? ''
  for (const id of ['necessary', 'analytics', 'marketing'] as const) flat[`cookie.${id}`] = cookieContent.categories.find((c) => c.id === id)?.description.value ?? ''
  flat['production.intro'] = productionContent.intro.value ?? ''
  for (const id of productionStepIds) {
    flat[`production.${id}.title`] = stepById[id]?.title.value ?? ''
    flat[`production.${id}.text`] = stepById[id]?.text.value ?? ''
  }
  flat['sizeGuide.table'] = sizeGuideContent.table.value ?? ''
  flat['sizeGuide.note'] = sizeGuideContent.note.value ?? ''
  for (const p of editableInfoPages) p.sections.forEach((s, i) => (flat[`info.${p.slug}.${i}`] = s.value ?? ''))
  return flat
}

const contentKeys = Object.keys(buildInitialForm())

/**
 * `GET /admin/content`'in TAZE yanıtından formu yeniden kurar. Sayfa yeniden monte edildiğinde
 * `data/content.ts`'in açılış anı görüntüsü güncel olmayabilir — aynı öncelik zinciri taze veriyle uygulanır.
 */
function buildFormFromFields(fields: Record<string, string | null>): FlatForm {
  const o = readAdminData().content
  const b = (o.brand ?? {}) as Record<string, string | undefined>
  const p = o.production ?? {}
  const cc = (o.cookieCategories ?? {}) as Record<string, string | undefined>
  const flat: FlatForm = {}
  for (const k of brandContentKeys) flat[`brand.${k}`] = resolveField(fields[`brand.${k}`], b[k], contentTexts[`brand.${k}`])
  flat['cookie.bannerText'] = resolveField(fields['cookie.bannerText'], o.cookieText, contentTexts['cookie.bannerText'])
  for (const id of ['necessary', 'analytics', 'marketing']) flat[`cookie.${id}`] = resolveField(fields[`cookie.${id}`], cc[id], contentTexts[`cookie.${id}`])
  flat['production.intro'] = resolveField(fields['production.intro'], p.intro, contentTexts['production.intro'])
  for (const id of productionStepIds) {
    flat[`production.${id}.title`] = resolveField(fields[`production.${id}.title`], p.steps?.[id]?.title, contentTexts[`production.${id}.title`])
    flat[`production.${id}.text`] = resolveField(fields[`production.${id}.text`], p.steps?.[id]?.text, contentTexts[`production.${id}.text`])
  }
  flat['sizeGuide.table'] = resolveField(fields['sizeGuide.table'], o.sizeGuide?.table, contentTexts['sizeGuide.table'])
  flat['sizeGuide.note'] = resolveField(fields['sizeGuide.note'], o.sizeGuide?.note, contentTexts['sizeGuide.note'])
  for (const page of editableInfoPages) {
    page.sections.forEach((_, i) => {
      flat[`info.${page.slug}.${i}`] = resolveField(fields[`info.${page.slug}.${i}`], o.infoPages?.[page.slug]?.[i], infoSectionTexts[page.slug]?.[i])
    })
  }
  return flat
}

/**
 * `form` ile `baseline` (son yüklenen/kaydedilen durum) arasındaki FARKI üretir — yalnızca gerçekten
 * değişen alanlar gönderilir. Aksi halde `contentTexts.ts`'teki yer tutucu varsayılan metinler hiç
 * dokunulmamış alanlara bile gerçek içerikmiş gibi DB'ye yazılırdı. Boş → null (alanı temizler).
 */
function buildPatch(form: FlatForm, baseline: FlatForm): Record<string, string | null> {
  const patch: Record<string, string | null> = {}
  for (const key of contentKeys) {
    const trimmed = (form[key] ?? '').trim()
    if (trimmed === (baseline[key] ?? '').trim()) continue
    patch[key] = trimmed ? trimmed : null
  }
  return patch
}

/** EN değeri: API `fieldsEn` (taze) > yönetici paneli localStorage EN override'ı > hazır İngilizce metin > boş. */
function buildEnForm(fieldsEn: Record<string, string>): FlatForm {
  const local = readAdminData().content.en ?? {}
  return Object.fromEntries(contentKeys.map((key) => [key, clean(fieldsEn[key]) ?? clean(local[key]) ?? contentDefaultsEn[key] ?? '']))
}

/** Yerel (API'siz) kayıt için düz formdan ContentOverrides yapısı. */
function toLocalOverrides(flat: FlatForm) {
  return {
    brand: Object.fromEntries(brandContentKeys.map((k) => [k, flat[`brand.${k}`] ?? ''])) as Record<BrandContentKey, string>,
    infoPages: Object.fromEntries(editableInfoPages.map((p) => [p.slug, p.sections.map((_, i) => flat[`info.${p.slug}.${i}`] ?? '')])),
    cookieText: flat['cookie.bannerText'],
    cookieCategories: { necessary: flat['cookie.necessary'], analytics: flat['cookie.analytics'], marketing: flat['cookie.marketing'] },
    production: {
      intro: flat['production.intro'],
      steps: Object.fromEntries(productionStepIds.map((id) => [id, { title: flat[`production.${id}.title`], text: flat[`production.${id}.text`] }])) as Record<ProductionStepId, { title: string; text: string }>,
    },
    sizeGuide: { table: flat['sizeGuide.table'], note: flat['sizeGuide.note'] },
  }
}

/* ---------------- Alan grupları (sayfa bazlı) ---------------- */

interface FieldDef {
  key: string
  label: string
  short?: boolean
}

interface GroupDef {
  id: string
  section: 'site' | 'pages' | 'legal'
  title: string
  desc?: string
  href?: string
  hint?: string
  fields: FieldDef[]
}

const SHORT_BRAND: ReadonlySet<string> = new Set(['heroCta', 'companyName', 'phone', 'email', 'registry', 'collectionTitle'])

function buildGroups(): GroupDef[] {
  const stepById = Object.fromEntries(productionContent.steps.map((s) => [s.id, s]))
  const site: GroupDef[] = [
    {
      id: 'brand',
      section: 'site',
      title: AS.content.brandTitle,
      desc: AS.content.brandDesc,
      href: '/bilgi/iletisim',
      fields: brandContentKeys.map((k) => ({ key: `brand.${k}`, label: brandContent[k].label, short: SHORT_BRAND.has(k) })),
    },
    {
      id: 'cookie',
      section: 'site',
      title: AS.content.cookieTitle,
      desc: AS.content.cookieDesc,
      href: '/bilgi/cerez-politikasi',
      fields: [
        { key: 'cookie.bannerText', label: cookieContent.bannerText.label },
        ...cookieContent.categories.map((c) => ({ key: `cookie.${c.id}`, label: c.description.label })),
      ],
    },
    {
      id: 'production',
      section: 'site',
      title: AS.content.productionTitle,
      desc: AS.content.productionDesc,
      href: '/',
      fields: [
        { key: 'production.intro', label: AS.content.productionIntroLabel },
        ...productionStepIds.flatMap((id) => [
          { key: `production.${id}.title`, label: stepById[id]?.title.label ?? id, short: true },
          { key: `production.${id}.text`, label: stepById[id]?.text.label ?? id },
        ]),
      ],
    },
    {
      id: 'sizeGuide',
      section: 'site',
      title: AS.content.sizeGuideTitle,
      desc: AS.content.sizeGuideDesc,
      fields: [
        { key: 'sizeGuide.table', label: sizeGuideContent.table.label },
        { key: 'sizeGuide.note', label: sizeGuideContent.note.label },
      ],
    },
  ]
  const pages: GroupDef[] = editableInfoPages.map((p) => ({
    id: `info-${p.slug}`,
    section: LEGAL_SLUGS.has(p.slug) ? 'legal' : 'pages',
    title: p.title,
    href: `/bilgi/${p.slug}`,
    hint: p.slug === 'sss' ? AS.content.sssHint : LEGAL_SLUGS.has(p.slug) ? AS.content.legalHint : undefined,
    fields: p.sections.map((s, i) => ({ key: `info.${p.slug}.${i}`, label: s.label })),
  }))
  return [...site, ...pages]
}

const SECTION_TITLES = { site: AS.content.groupSite, pages: AS.content.groupPages, legal: AS.content.groupLegal } as const

const lower = (s: string) => s.toLocaleLowerCase('tr-TR')

/** `/admin/icerik` — sayfa bazlı akordeon; her alan TR ve EN yan yana; yalnızca değişen alanlar kaydedilir. */
export function ContentPage() {
  const [form, setForm] = useState<FlatForm>(buildInitialForm)
  const [baseline, setBaseline] = useState<FlatForm>(buildInitialForm)
  const [enForm, setEnForm] = useState<FlatForm>(() => buildEnForm({}))
  const [enBaseline, setEnBaseline] = useState<FlatForm>(() => buildEnForm({}))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(!useApiMode)
  const [reloadToken, setReloadToken] = useState(0)
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState<Set<string>>(() => new Set(['brand']))
  const [query, setQuery] = useState('')
  const toast = useToast()
  const groups = useMemo(() => buildGroups(), [])

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

  const patch = useMemo(() => buildPatch(form, baseline), [form, baseline])
  const patchEn = useMemo(() => buildPatch(enForm, enBaseline), [enForm, enBaseline])
  const changes = Object.keys(patch).length + Object.keys(patchEn).length
  const dirty = changes > 0

  async function handleSave() {
    if (!dirty) return
    if (useApiMode) {
      setPending(true)
      try {
        await updateAdminContentFields(patch, patchEn)
        setBaseline(form)
        setEnBaseline(enForm)
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
      content: {
        ...toLocalOverrides(form),
        // Yalnızca hazır İngilizce metinden FARKLI dolu EN değerleri saklanır (varsayılanı dondurmamak için).
        en: Object.fromEntries(
          contentKeys.map((key) => [key, (enForm[key] ?? '').trim()] as const).filter(([key, value]) => value && value !== (contentDefaultsEn[key] ?? '').trim()),
        ),
      },
    }))
    setBaseline(form)
    setEnBaseline(enForm)
    toast.success(AS.save.savedLocal)
  }

  const q = lower(query.trim())
  const visibleGroups = groups
    .map((g) => {
      if (!q) return g
      if (lower(g.title).includes(q)) return g
      const fields = g.fields.filter((f) => lower(f.label).includes(q) || lower(form[f.key] ?? '').includes(q))
      return fields.length ? { ...g, fields } : null
    })
    .filter((g): g is GroupDef => g != null)

  function toggle(id: string) {
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loadError && !loaded) {
    return (
      <>
        <PageHeader title={AS.content.title} description={AS.content.subtitle} />
        <ErrorState message={loadError} onRetry={() => setReloadToken((t) => t + 1)} />
      </>
    )
  }

  const allOpen = visibleGroups.every((g) => open.has(g.id))

  return (
    <div>
      <PageHeader
        title={AS.content.title}
        description={AS.content.subtitle}
        actions={
          <Btn variant="ghost" icon={allOpen ? 'chevron-up' : 'chevron-down'} onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.id)))}>
            {allOpen ? AS.content.collapseAll : AS.content.expandAll}
          </Btn>
        }
      />
      {useApiMode ? null : <Notice tone="warning">{AS.demoNotice}</Notice>}
      <Notice tone="neutral">{AS.content.enNote}</Notice>
      <FilterBar search={{ value: query, onChange: setQuery, placeholder: AS.content.filterPlaceholder }} active={!!query} onClear={() => setQuery('')} />

      {visibleGroups.length === 0 ? (
        <div className={ui.card}>
          <EmptyState icon="search" title={AS.content.noMatch} />
        </div>
      ) : null}

      <fieldset disabled={!loaded} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {(['site', 'pages', 'legal'] as const).map((section) => {
          const list = visibleGroups.filter((g) => g.section === section)
          if (!list.length) return null
          return (
            <div key={section}>
              <h2 className={styles.groupHeading}>{SECTION_TITLES[section]}</h2>
              {list.map((g) => {
                const isOpen = open.has(g.id) || !!q
                const changed = g.fields.filter((f) => f.key in patch || f.key in patchEn).length
                const bodyId = `cg-${g.id}`
                return (
                  <div key={g.id} className={[styles.accordion, isOpen ? styles.accordionOpen : ''].join(' ')}>
                    <button type="button" className={styles.accordionHead} aria-expanded={isOpen} aria-controls={bodyId} onClick={() => toggle(g.id)}>
                      <span style={{ minWidth: 0 }}>
                        <span className={styles.accordionTitle}>{g.title}</span>
                        {g.desc ? <span className={styles.accordionDesc}> · {g.desc}</span> : null}
                      </span>
                      {changed ? <StatusBadge tone="warning">{AS.content.changedCount(changed)}</StatusBadge> : null}
                      <AdminIcon name="chevron-down" size={18} className={styles.accordionChevron} />
                    </button>
                    {isOpen ? (
                      <div id={bodyId} className={styles.accordionBody}>
                        {g.href || g.hint ? (
                          <div className={ui.row} style={{ justifyContent: 'space-between', paddingTop: 12 }}>
                            {g.hint ? <p className={ui.hint} style={{ flex: 1, minWidth: 220 }}>{g.hint}</p> : <span />}
                            {g.href ? (
                              <a className={[ui.btn, ui.btnGhost, ui.btnSm].join(' ')} href={g.href} target="_blank" rel="noopener noreferrer">
                                <AdminIcon name="external" size={16} />
                                {AS.content.viewPage}
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                        <div className={styles.pairHead} aria-hidden="true">
                          <span>{AS.content.trHeading}</span>
                          <span>{AS.content.enHeading}</span>
                        </div>
                        {g.fields.map((f) => {
                          const trChanged = f.key in patch
                          const enChanged = f.key in patchEn
                          const trId = `c-${f.key}`
                          const enId = `c-${f.key}-en`
                          const rows = f.short ? 1 : g.id === 'info-sss' ? 6 : 3
                          return (
                            <div key={f.key} className={styles.pairRow}>
                              <div className={styles.pairLabel}>
                                {f.label}
                                {trChanged || enChanged ? <StatusBadge tone="warning">{AS.content.changed}</StatusBadge> : null}
                              </div>
                              <div className={styles.pairFields}>
                                <div className={ui.field}>
                                  <label htmlFor={trId} className="sr-only">
                                    {f.label} — {AS.content.trHeading}
                                  </label>
                                  <AutoTextarea id={trId} rows={rows} lang="tr" value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
                                </div>
                                <div className={ui.field}>
                                  <label htmlFor={enId} className="sr-only">
                                    {AS.content.enLabel(f.label)}
                                  </label>
                                  <AutoTextarea
                                    id={enId}
                                    rows={rows}
                                    lang="en"
                                    placeholder={AS.content.enPlaceholder}
                                    value={enForm[f.key] ?? ''}
                                    onChange={(e) => setEnForm((s) => ({ ...s, [f.key]: e.target.value }))}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )
        })}
      </fieldset>

      <StickySaveBar
        dirty={dirty}
        saving={pending}
        changes={changes}
        onSave={() => void handleSave()}
        onDiscard={() => {
          setForm(baseline)
          setEnForm(enBaseline)
          toast.info(AS.save.discarded)
        }}
      />
    </div>
  )
}
