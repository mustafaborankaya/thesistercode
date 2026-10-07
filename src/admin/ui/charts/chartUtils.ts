/**
 * Grafik yardımcıları — sayı/tarih biçimlendirme (tr-TR), eksen aralıkları, seri tonları.
 * Grafikler saf inline SVG + React'tir; bağımlılık yoktur. Para biçimi için ui/format.ts → formatPrice.
 */

const nfInt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })
const nfCompact = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 })
const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 12.345 */
export function fmtInt(n: number): string {
  return nfInt.format(Math.round(n))
}

/** Eksen etiketi: 9.800 → "9.800", 12.400 → "12,4 B" (bin), 1.250.000 → "1,3 Mn". */
export function fmtCompact(n: number): string {
  return Math.abs(n) < 10000 ? nfInt.format(Math.round(n)) : nfCompact.format(n)
}

/**
 * Eksen etiketleri için biçimleyici: eksenin en üst değeri 10.000 ve üzerindeyse TÜM etiketler kısa
 * ("5 B", "10 B"), değilse tam sayı ("5.000") — bir eksende iki biçim karışmaz.
 */
export function axisFormatter(top: number): (n: number) => string {
  return top >= 10000 ? (n) => nfCompact.format(n) : (n) => nfInt.format(Math.round(n))
}

/** %12,5 (varsayılan 1 ondalık; `digits` 2 ise %1,23) */
export function fmtPct(p: number, digits: 1 | 2 = 1): string {
  return `%${(digits === 2 ? nf2 : nf1).format(p)}`
}

/** Pay: part/total → "%62,1"; total 0 ise "—". */
export function sharePct(part: number, total: number): string {
  return total > 0 ? fmtPct((part / total) * 100) : '—'
}

/** 'YYYY-MM-DD' → yerel tarih (saat dilimi kayması olmadan). */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const dayShort = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' })
const dayLong = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
const monthShort = new Intl.DateTimeFormat('tr-TR', { month: 'short', year: '2-digit' })
const monthLong = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' })

/** "7 Eki" */
export function fmtDayShort(iso: string): string {
  return dayShort.format(parseDay(iso))
}

/** "Çar 7 Ekim 2026" */
export function fmtDayLong(iso: string): string {
  return dayLong.format(parseDay(iso))
}

/** "Eki 26" */
export function fmtMonthShort(iso: string): string {
  return monthShort.format(parseDay(iso))
}

/** "Ekim 2026" */
export function fmtMonthLong(iso: string): string {
  return monthLong.format(parseDay(iso))
}

/** 0'dan başlayan "temiz" eksen aralıkları (1/2/2,5/5 × 10ⁿ adım); max ≤ 0 ise [0, 1]. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1]
  const rough = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const top = Math.ceil(max / step - 1e-9) * step
  const out: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) out.push(Number(v.toFixed(10)))
  return out
}

/** n noktadan en fazla `maxLabels` eşit aralıklı dizin seçer; ilk ve son her zaman dahildir. */
export function pickTickIndexes(n: number, maxLabels: number): number[] {
  if (n <= 0) return []
  const limit = Math.max(2, maxLabels)
  if (n <= limit) return Array.from({ length: n }, (_, i) => i)
  const step = Math.ceil((n - 1) / (limit - 1))
  const out: number[] = []
  for (let i = 0; i < n; i += step) out.push(i)
  const last = out[out.length - 1]
  if (last !== n - 1) {
    if (n - 1 - last < step / 2) out[out.length - 1] = n - 1
    else out.push(n - 1)
  }
  return out
}

/**
 * Seri tonları — panelin mürekkep tonları + tek vurgu (bkz. charts.module.css `.root`).
 * Monokrom palet: seriler açıklıkla ayrılır (ΔE ≥ 16, tüm renk körlüğü türlerinde ayırt edilebilir);
 * kimlik ayrıca lejant, uç etiket ve veri tablosuyla taşınır.
 */
export type ChartTone = 'ink' | 'soft' | 'faint' | 'accent'

export const toneFill: Record<ChartTone, string> = {
  ink: 'var(--c-ink-1)',
  soft: 'var(--c-ink-2)',
  faint: 'var(--c-ink-3)',
  accent: 'var(--c-accent)',
}

/** Pay dilimleri (donut): en büyük dilim en koyu; en fazla 6 dilim (fazlası "Diğer"e katlanır). */
export const sliceFills = ['var(--c-ink-1)', 'var(--c-ink-2)', 'var(--c-ink-3)', 'var(--c-ink-4)', 'var(--c-ink-5)', 'var(--c-ink-6)']

/** Sıralı (ordinal) mürekkep rampası — huni adımları, açıktan koyuya (doğrulandı: tek ton, ΔL ≥ 0,06, açık uç ≥ 2:1). */
export const ordinalFills = ['var(--c-ink-4)', 'var(--c-ink-3)', 'var(--c-ink-2)', '#333331', 'var(--c-ink-1)']

/** Klavye gezinmesi: ok tuşlarıyla etkin nokta; Esc kapatır. Tuş ilgisizse undefined döner. */
export function stepIndex(key: string, current: number | null, n: number): number | null | undefined {
  if (n <= 0) return null
  const cur = current ?? -1
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(n - 1, cur + 1)
    case 'ArrowLeft':
    case 'ArrowUp':
      return cur <= 0 ? 0 : cur - 1
    case 'Home':
      return 0
    case 'End':
      return n - 1
    case 'Escape':
      return null
    default:
      return undefined
  }
}
