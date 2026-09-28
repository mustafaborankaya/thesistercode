import { useState } from 'react'
import { brandMedia, brandMediaNames } from '../../data/media'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { getAdminContent, updateAdminBrandMedia, useApiMode } from '../adminApi'
import { AS } from '../adminStrings'
import { ApiMediaField } from '../components/ApiMediaField'
import { MediaField } from '../components/MediaField'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { FormSection } from '../ui/FormSection'
import { ErrorState, Notice, PageHeader } from '../ui/Page'
import { useToast } from '../ui/toastContext'
import { useLoader } from '../ui/useLoader'
import styles from '../admin.module.css'

type MediaKey = keyof typeof brandMediaNames

interface Slot {
  key: MediaKey
  ratio: string
  ratioLabel: string
  kind: 'image' | 'video'
}

const groups: { title: string; desc: string; slots: Slot[]; wide?: boolean }[] = [
  {
    title: AS.mediaPage.groupHero,
    desc: AS.mediaPage.groupHeroDesc,
    wide: true,
    slots: [
      { key: 'heroDesktop', ratio: '1440 / 560', ratioLabel: '1440×560', kind: 'image' },
      { key: 'heroMobile', ratio: '780 / 840', ratioLabel: '780×840', kind: 'image' },
    ],
  },
  {
    title: AS.mediaPage.groupBrand,
    desc: AS.mediaPage.groupBrandDesc,
    slots: [
      { key: 'collection', ratio: '16 / 10', ratioLabel: '16:10', kind: 'image' },
      { key: 'auth', ratio: '3 / 4', ratioLabel: '3:4', kind: 'image' },
      { key: 'logo', ratio: '1 / 1', ratioLabel: '1:1', kind: 'image' },
    ],
  },
  {
    title: AS.mediaPage.groupProduction,
    desc: AS.mediaPage.groupProductionDesc,
    slots: [
      { key: 'productionVideo', ratio: '16 / 9', ratioLabel: '16:9', kind: 'video' },
      { key: 'productionVideoPoster', ratio: '16 / 9', ratioLabel: '16:9', kind: 'image' },
      { key: 'productionCutting', ratio: '4 / 5', ratioLabel: '4:5', kind: 'image' },
      { key: 'productionSewing', ratio: '4 / 5', ratioLabel: '4:5', kind: 'image' },
      { key: 'productionQuality', ratio: '4 / 5', ratioLabel: '4:5', kind: 'image' },
    ],
  },
]

/**
 * `/admin/gorseller` — marka görselleri (açılış, koleksiyon, giriş, logo, üretim). API modunda
 * `POST /admin/upload` (ad kuralı: brandMediaNames) + `PUT /admin/brand-media`; kaldırma `null`.
 * Yerel demo modunda IndexedDB (MediaField).
 */
export function MediaPage() {
  return (
    <div>
      <PageHeader title={AS.mediaPage.title} description={AS.mediaPage.subtitle} />
      {useApiMode ? <ApiMediaGroups /> : <LocalMediaGroups />}
    </div>
  )
}

function ApiMediaGroups() {
  // `brandMedia` (data/media.ts) yalnızca açılış anı görüntüsüdür; taze değerler GET /admin/content'ten.
  const loader = useLoader(() => getAdminContent().then((c) => c.brandMedia))
  const [overrides, setOverrides] = useState<Partial<Record<MediaKey, string | null>>>({})
  const [confirmKey, setConfirmKey] = useState<MediaKey | null>(null)
  const [removing, setRemoving] = useState(false)
  const toast = useToast()

  function srcOf(key: MediaKey): string | null {
    if (key in overrides) return overrides[key] ?? null
    const fresh = loader.data
    const name = brandMediaNames[key]
    if (fresh && name in fresh) return fresh[name] ?? null
    return brandMedia[key]
  }

  async function write(key: MediaKey, url: string | null) {
    await updateAdminBrandMedia({ [brandMediaNames[key]]: url })
    setOverrides((m) => ({ ...m, [key]: url }))
  }

  async function confirmRemove() {
    if (!confirmKey) return
    const label = AS.settings.mediaLabels[confirmKey]
    setRemoving(true)
    try {
      await write(confirmKey, null)
      toast.success(AS.mediaPage.removed(label))
      setConfirmKey(null)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setRemoving(false)
    }
  }

  if (loader.error && !loader.data) return <ErrorState message={apiErrorMessage(loader.error)} onRetry={loader.reload} />

  return (
    <>
      <Notice tone="neutral">{AS.mediaPage.hint}</Notice>
      {groups.map((g) => (
        <FormSection key={g.title} title={g.title} description={g.desc}>
          <div className={g.wide ? styles.mediaGridWide : styles.mediaGrid}>
            {g.slots.map((m) => {
              const label = AS.settings.mediaLabels[m.key]
              return (
                <ApiMediaField
                  key={m.key}
                  name={brandMediaNames[m.key]}
                  label={label}
                  src={srcOf(m.key)}
                  ratio={m.ratio}
                  kind={m.kind}
                  meta={m.ratioLabel}
                  pendingExternal={loader.initial || (removing && confirmKey === m.key)}
                  savedMessage={AS.mediaPage.saved(label)}
                  onUpload={(url) => write(m.key, url)}
                  onRequestRemove={() => setConfirmKey(m.key)}
                />
              )
            })}
          </div>
        </FormSection>
      ))}
      <ConfirmDialog
        open={confirmKey != null}
        title={confirmKey ? AS.mediaPage.removeTitle(AS.settings.mediaLabels[confirmKey]) : ''}
        message={AS.mediaPage.removeText}
        confirmLabel={AS.mediaPage.removeConfirm}
        tone="danger"
        pending={removing}
        onCancel={() => setConfirmKey(null)}
        onConfirm={() => void confirmRemove()}
      />
    </>
  )
}

function LocalMediaGroups() {
  return (
    <>
      <Notice tone="warning">{AS.demoNotice}</Notice>
      {groups.map((g) => (
        <FormSection key={g.title} title={g.title} description={g.desc}>
          <div className={g.wide ? styles.mediaGridWide : styles.mediaGrid}>
            {g.slots.map((m) => (
              <MediaField key={m.key} name={brandMediaNames[m.key]} label={AS.settings.mediaLabels[m.key]} ratio={m.ratio} kind={m.kind} meta={m.ratioLabel} />
            ))}
          </div>
        </FormSection>
      ))}
    </>
  )
}
