import { usePreviewVersion, type ContentField } from '../../data/content'
import { S } from '../../i18n'
import { LegalText, hasLegalMarkup } from './LegalText'

interface ContentTextProps {
  field: ContentField
  as?: 'p' | 'span' | 'div'
  className?: string
  /** Yer tutucu biçiminde "— içerik eklenecek" son ekini gizle (kısa alanlar için). */
  short?: boolean
}

/**
 * İçerik alanı: gerçek metin varsa onu, yoksa alan adını gösterir. Kök elemana `data-content-key` basılır
 * (yönetici paneli önizlemesi değişen alanı bununla bulur; görünüme etkisi yoktur).
 */
export function ContentText({ field, as = 'p', className, short }: ContentTextProps) {
  // Panel önizlemesinde taslak değişince yeniden çizilsin.
  usePreviewVersion()
  const Tag = as
  const key = field.key ?? undefined
  // Satır sonları korunur (ölçü tablosu, SSS, adım listeleri).
  if (field.value && hasLegalMarkup(field.value)) return <LegalText text={field.value} className={className} contentKey={key} />
  if (field.value)
    return (
      <Tag className={className} style={{ whiteSpace: 'pre-line' }} data-content-key={key}>
        {field.value}
      </Tag>
    )
  return (
    <Tag className={[className ?? '', 'text-soft'].join(' ').trim()} data-content-field={field.label} data-content-key={key}>
      {short ? field.label : S.info.pendingField(field.label)}
    </Tag>
  )
}
