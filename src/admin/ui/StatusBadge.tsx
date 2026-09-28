import type { ReactNode } from 'react'
import s from './ui.module.css'

import type { BadgeTone } from './tones'

const toneClass: Record<BadgeTone, string> = {
  success: s.badgeSuccess,
  warning: s.badgeWarning,
  danger: s.badgeDanger,
  neutral: s.badgeNeutral,
  outline: s.badgeOutline,
}

/** Küçük durum rozeti (nokta + metin). Renk yalnızca durum bildirir: başarı/uyarı/hata/nötr. */
export function StatusBadge({ tone = 'neutral', children, dot = true, title }: { tone?: BadgeTone; children: ReactNode; dot?: boolean; title?: string }) {
  return (
    <span className={[s.badge, toneClass[tone], dot ? '' : s.badgePlain].join(' ')} title={title}>
      {children}
    </span>
  )
}

