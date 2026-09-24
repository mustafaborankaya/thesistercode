import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Icon } from './Icon'
import styles from './Field.module.css'

interface BaseFieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  /** Sağ kenara yerleşen kontrol (şifre göster/gizle vb.). */
  adornment?: ReactNode
}

type InputFieldProps = BaseFieldProps & InputHTMLAttributes<HTMLInputElement>

/** Görünür etiketli, hata mesajı alanın yanında gösterilen form alanı. */
export const Field = forwardRef<HTMLInputElement, InputFieldProps>(function Field({ label, hint, error, adornment, id, className, ...rest }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <div className={[styles.field, className ?? ''].join(' ').trim()}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className={[error ? styles.invalid : '', adornment ? styles.adornedInput : ''].join(' ').trim() || undefined}
          {...rest}
        />
        {adornment ? <div className={styles.adornment}>{adornment}</div> : null}
      </div>
      {hint ? (
        <div id={hintId} className={styles.hint}>
          {hint}
        </div>
      ) : null}
      {error ? (
        <div id={errorId} className={styles.error} role="alert">
          <Icon name="info" size={14} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  )
})

type TextareaFieldProps = BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField({ label, hint, error, id, className, ...rest }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <div className={[styles.field, className ?? ''].join(' ').trim()}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <textarea ref={ref} id={inputId} aria-invalid={error ? true : undefined} aria-describedby={errorId} className={error ? styles.invalid : undefined} {...rest} />
      {hint ? <div className={styles.hint}>{hint}</div> : null}
      {error ? (
        <div id={errorId} className={styles.error} role="alert">
          <Icon name="info" size={14} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  )
})

type SelectFieldProps = BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField({ label, hint, error, id, className, children, ...rest }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <div className={[styles.field, className ?? ''].join(' ').trim()}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <select ref={ref} id={inputId} aria-invalid={error ? true : undefined} aria-describedby={errorId} className={error ? styles.invalid : undefined} {...rest}>
        {children}
      </select>
      {hint ? <div className={styles.hint}>{hint}</div> : null}
      {error ? (
        <div id={errorId} className={styles.error} role="alert">
          <Icon name="info" size={14} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  )
})

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  error?: string | null
}

export function Checkbox({ label, error, id, className, ...rest }: CheckboxProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <div className={[styles.field, className ?? ''].join(' ').trim()}>
      <label htmlFor={inputId} className={styles.checkbox}>
        <input type="checkbox" id={inputId} aria-invalid={error ? true : undefined} aria-describedby={errorId} {...rest} />
        <span>{label}</span>
      </label>
      {error ? (
        <div id={errorId} className={styles.error} role="alert">
          <Icon name="info" size={14} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  )
}

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: ReactNode
}

/** Çerez tercihleri gibi açık/kapalı ayarlar için anahtar. */
export function Switch({ label, description, id, className, ...rest }: SwitchProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={[styles.field, className ?? ''].join(' ').trim()}>
      <label htmlFor={inputId} className={styles.switch}>
        <span>{label}</span>
        <input type="checkbox" role="switch" id={inputId} {...rest} />
      </label>
      {description ? <div className={styles.hint}>{description}</div> : null}
    </div>
  )
}
