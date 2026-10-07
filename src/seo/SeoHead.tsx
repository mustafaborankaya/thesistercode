import { useEffect } from 'react'
import { applySeo } from './dom'
import type { PageMeta } from './seo'

/** Sayfa metasını belgeye uygular; hiçbir şey çizmez. Tek yönetici: başka yerde `<title>`/`<meta>` basılmaz. */
export function SeoHead({ meta }: { meta: PageMeta }) {
  useEffect(() => {
    applySeo(meta)
  }, [meta])
  return null
}
