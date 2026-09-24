import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  block?: boolean
  small?: boolean
  /** Verilirse <Link> olarak render edilir. */
  to?: string
}

function cls(variant: Variant, block?: boolean, small?: boolean, extra?: string) {
  return [styles.button, styles[variant], block ? styles.block : '', small ? styles.small : '', extra ?? ''].filter(Boolean).join(' ')
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', block, small, to, className, children, type = 'button', ...rest },
  ref,
) {
  const classes = cls(variant, block, small, className)
  if (to) {
    return (
      <Link to={to} className={classes} {...(rest as object)}>
        {children}
      </Link>
    )
  }
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {children}
    </button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  /** Erişilebilir ad; görünür etiket yoksa zorunlu. */
  label: string
  /** Görünür metin (masaüstü header'da "Sepet (2)" gibi). */
  showLabel?: boolean
  labelText?: ReactNode
  to?: string
  size?: number
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, showLabel, labelText, to, size = 20, className, children, type = 'button', ...rest },
  ref,
) {
  const classes = [styles.iconButton, className ?? ''].join(' ').trim()
  const content = (
    <>
      <Icon name={icon} size={size} />
      {showLabel ? <span className={styles.iconButtonLabel}>{labelText ?? label}</span> : <span className="sr-only">{label}</span>}
      {children}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={classes} aria-label={showLabel ? undefined : label} {...(rest as object)}>
        {content}
      </Link>
    )
  }
  return (
    <button ref={ref} type={type} className={classes} aria-label={showLabel ? undefined : label} {...rest}>
      {content}
    </button>
  )
})
