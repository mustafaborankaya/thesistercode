/** Panel biçimlendirme yardımcıları (tr-TR). */
export { formatPrice } from '../../lib/format'

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(v: string | null | undefined): string {
  const d = toDate(v)
  return d ? dateFmt.format(d) : '—'
}

export function formatDateTime(v: string | null | undefined): string {
  const d = toDate(v)
  return d ? dateTimeFmt.format(d) : '—'
}

/** Bugünse yalnızca saat ("Bugün 14:05"), değilse tarih + saat. */
export function formatWhen(v: string | null | undefined): string {
  const d = toDate(v)
  if (!d) return '—'
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return `Bugün ${timeFmt.format(d)}`
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `Dün ${timeFmt.format(d)}`
  return dateTimeFmt.format(d)
}

/** YYYY-MM-DD (yerel saat) */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "1.499,90" / "1499.9" / "1499,90" → 1499.9; geçersizse null. Boş metin → null. */
export function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/\s|TL|₺/gi, '')
  if (!t) return null
  let norm = t
  if (/,\d{1,2}$/.test(t)) norm = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) norm = t.replace(/\./g, '')
  if (!/^\d+(\.\d+)?$/.test(norm)) return null
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

/** Pozitif tam sayı ya da boş (null). Geçersizse undefined. */
export function parseOptionalInt(raw: string, min = 0): number | null | undefined {
  const t = raw.trim()
  if (!t) return null
  if (!/^\d+$/.test(t)) return undefined
  const n = Number(t)
  return n >= min ? n : undefined
}
