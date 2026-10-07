import { toneFill } from './chartUtils'
import s from './charts.module.css'

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
}

/**
 * KPI kartı içindeki küçük eğilim çizgisi — dekoratif (aria-hidden); değeri kart metni taşır.
 * Çizgi soluk mürekkep, son nokta vurgu rengi. Renk değişkenleri için `.root` sınıfını kendi üstünde taşır.
 */
export function Sparkline({ values, width = 88, height = 28 }: SparklineProps) {
  const n = values.length
  const max = Math.max(0, ...values)
  // Hiç veri yoksa düz çizgi çizmek yerine hiç çizme (sakin boş durum).
  if (n < 2 || max === 0) return null
  const padY = 3
  const innerH = height - padY * 2
  const x = (i: number) => (i * (width - 4)) / (n - 1) + 2
  const y = (v: number) => padY + innerH - (max > 0 ? (v / max) * innerH : 0)
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className={[s.root, s.spark].join(' ')} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke={toneFill.faint} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(values[n - 1])} r={3} fill={toneFill.accent} stroke="var(--a-card)" strokeWidth={1.5} />
    </svg>
  )
}
