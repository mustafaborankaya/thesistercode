import type { ContentField } from '../../data/content'
import { S } from '../../i18n'

interface ContentTextProps {
  field: ContentField
  as?: 'p' | 'span' | 'div'
  className?: string
  /** Yer tutucu biçiminde "— içerik eklenecek" son ekini gizle (kısa alanlar için). */
  short?: boolean
}

/** İçerik alanı: gerçek metin varsa onu, yoksa alan adını gösterir. */
export function ContentText({ field, as = 'p', className, short }: ContentTextProps) {
  const Tag = as
  if (field.value) return <Tag className={className}>{field.value}</Tag>
  return (
    <Tag className={[className ?? '', 'text-soft'].join(' ').trim()} data-content-field={field.label}>
      {short ? field.label : S.info.pendingField(field.label)}
    </Tag>
  )
}
