import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AdminIcon, type AdminIconName } from './AdminIcon'
import s from './ui.module.css'

export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: 'md' | 'sm'
  icon?: AdminIconName
  /** Yalnızca ikon: görünür metin yok, `label` erişilebilir ad olur. */
  iconOnly?: boolean
  label?: string
  loading?: boolean
  /** Verilirse <Link> olarak çizilir. */
  to?: string
  children?: ReactNode
}

const variantClass: Record<BtnVariant, string> = {
  primary: s.btnPrimary,
  secondary: s.btnSecondary,
  ghost: s.btnGhost,
  danger: s.btnDanger,
  'danger-solid': s.btnDangerSolid,
}

function btnClass(variant: BtnVariant = 'secondary', size: 'md' | 'sm' = 'md', iconOnly = false, extra?: string): string {
  return [s.btn, variantClass[variant], size === 'sm' ? s.btnSm : '', iconOnly ? s.btnIcon : '', extra ?? ''].filter(Boolean).join(' ')
}

/** Panel düğmesi — birincil (siyah), ikincil (çerçeveli), hayalet, tehlike. */
export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant = 'secondary', size = 'md', icon, iconOnly, label, loading, to, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  const cls = btnClass(variant, size, iconOnly, className)
  const iconSize = size === 'sm' ? 16 : 18
  const content = (
    <>
      {loading ? <span className={s.spinner} aria-hidden="true" /> : icon ? <AdminIcon name={icon} size={iconSize} /> : null}
      {iconOnly ? <span className="sr-only">{label}</span> : children}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}>
        {content}
      </Link>
    )
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      title={iconOnly ? label : rest.title}
      {...rest}
    >
      {content}
    </button>
  )
})
