import { Fragment, type ReactNode } from 'react'
import styles from './LegalText.module.css'

/**
 * Hukuki metinler için hafif biçimlendirme (panelden yapıştırılan sözleşme metinleri):
 *   "## Başlık" / "### Alt başlık" → başlık, "* madde" → liste, "---" → ayırıcı,
 *   "**kalın**" → kalın, "*italik*" (tek satır) → italik, boş satır → paragraf.
 * HTML hiçbir zaman ham olarak basılmaz; her şey metin düğümü olarak çizilir.
 */
export function hasLegalMarkup(text: string): boolean {
  return /^(#{2,3} |\* |---\s*$)/m.test(text) || /\*\*[^*]+\*\*/.test(text)
}

function inline(text: string, key: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong>
    return <Fragment key={`${key}-${i}`}>{p}</Fragment>
  })
}

/** `contentKey`: sarmalayıcı div'e basılan `data-content-key` (panel önizlemesi eşlemesi; görünümü etkilemez). */
export function LegalText({ text, className, contentKey }: { text: string; className?: string; contentKey?: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: ReactNode[] = []
  let para: string[] = []
  let list: string[] = []
  let k = 0
  const flushPara = () => {
    if (!para.length) return
    const id = `p-${k++}`
    out.push(
      <p key={id}>
        {para.map((l, i) => (
          <Fragment key={`${id}-${i}`}>
            {i > 0 ? <br /> : null}
            {inline(l, `${id}-${i}`)}
          </Fragment>
        ))}
      </p>,
    )
    para = []
  }
  const flushList = () => {
    if (!list.length) return
    const id = `ul-${k++}`
    out.push(
      <ul key={id}>
        {list.map((l, i) => (
          <li key={`${id}-${i}`}>{inline(l, `${id}-${i}`)}</li>
        ))}
      </ul>,
    )
    list = []
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    if (/^---\s*$/.test(line)) {
      flushPara()
      flushList()
      out.push(<hr key={`hr-${k++}`} />)
      continue
    }
    if (line.startsWith('### ')) {
      flushPara()
      flushList()
      out.push(<h3 key={`h3-${k++}`}>{inline(line.slice(4), `h3-${k}`)}</h3>)
      continue
    }
    if (line.startsWith('## ')) {
      flushPara()
      flushList()
      out.push(<h2 key={`h2-${k++}`}>{inline(line.slice(3), `h2-${k}`)}</h2>)
      continue
    }
    if (/^\* /.test(line)) {
      flushPara()
      list.push(line.slice(2))
      continue
    }
    if (/^\*[^*].*[^*]\*$/.test(line.trim())) {
      flushPara()
      flushList()
      out.push(<p key={`em-${k++}`} className={styles.note}><em>{line.trim().slice(1, -1)}</em></p>)
      continue
    }
    flushList()
    para.push(line)
  }
  flushPara()
  flushList()
  return (
    <div className={[styles.legal, className ?? ''].join(' ').trim()} data-content-key={contentKey}>
      {out}
    </div>
  )
}
