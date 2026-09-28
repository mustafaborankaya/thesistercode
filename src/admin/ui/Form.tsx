import { forwardRef, useCallback, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AdminIcon } from './AdminIcon'
import s from './ui.module.css'

interface FieldShellProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  className?: string
  children: ReactNode
  /** Etiketi görsel olarak gizle (erişilebilir kalır). */
  hideLabel?: boolean
}

function describedBy(id: string, hint?: ReactNode, error?: string | null): string | undefined {
  return [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
}

/** Etiket + kontrol + alan altı açıklama + hata. */
export function FieldShell({ id, label, hint, error, optional, className, children, hideLabel }: FieldShellProps) {
  return (
    <div className={[s.field, className ?? ''].join(' ').trim()}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : s.label}>
        {label}
        {optional ? <span className={s.labelOptional}>(isteğe bağlı)</span> : null}
      </label>
      {children}
      {error ? (
        <div id={`${id}-error`} className={s.error} role="alert">
          <AdminIcon name="alert" size={14} />
          <span>{error}</span>
        </div>
      ) : null}
      {hint ? (
        <div id={`${id}-hint`} className={s.hint}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}

type Common = { label: ReactNode; hint?: ReactNode; error?: string | null; optional?: boolean; hideLabel?: boolean; wrapClassName?: string }

export const TextField = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement> & { suffix?: string }>(function TextField(
  { label, hint, error, optional, hideLabel, wrapClassName, suffix, id, className, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id ?? auto
  const input = (
    <input
      ref={ref}
      id={fid}
      className={[s.control, className ?? ''].join(' ').trim()}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(fid, hint, error)}
      {...rest}
    />
  )
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} optional={optional} hideLabel={hideLabel} className={wrapClassName}>
      {suffix ? (
        <div className={s.inputAffix}>
          {input}
          <span className={s.affix} aria-hidden="true">
            {suffix}
          </span>
        </div>
      ) : (
        input
      )}
    </FieldShell>
  )
})

export const SelectField = forwardRef<HTMLSelectElement, Common & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField(
  { label, hint, error, optional, hideLabel, wrapClassName, id, className, children, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} optional={optional} hideLabel={hideLabel} className={wrapClassName}>
      <select
        ref={ref}
        id={fid}
        className={[s.control, className ?? ''].join(' ').trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  )
})

/** İçeriğe göre büyüyen metin alanı (uzun hukuki metinler için; `maxRows` sonrası kaydırılır). */
export function AutoTextarea({ className, value, maxRows = 24, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { maxRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20
    const max = line * maxRows + 20
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`
    el.style.overflowY = el.scrollHeight + 2 > max ? 'auto' : 'hidden'
  }, [maxRows])
  useEffect(resize, [value, resize])
  useEffect(() => {
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [resize])
  return <textarea ref={ref} value={value} className={[s.control, s.autoTextarea, className ?? ''].join(' ').trim()} {...rest} />
}

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  hideLabel,
  wrapClassName,
  id,
  autoGrow = true,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean; maxRows?: number }) {
  const auto = useId()
  const fid = id ?? auto
  const props = { id: fid, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy(fid, hint, error), ...rest }
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} optional={optional} hideLabel={hideLabel} className={wrapClassName}>
      {autoGrow ? <AutoTextarea {...props} /> : <textarea className={s.control} {...props} />}
    </FieldShell>
  )
}

export function CheckField({ label, hint, className, ...rest }: { label: ReactNode; hint?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={[s.check, className ?? ''].join(' ').trim()}>
      <input type="checkbox" {...rest} />
      <span>
        {label}
        {hint ? <span className={s.checkHint}>{hint}</span> : null}
      </span>
    </label>
  )
}

export function SwitchField({ label, hint, className, ...rest }: { label: ReactNode; hint?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <div className={className}>
      <label className={s.switch}>
        <input type="checkbox" role="switch" {...rest} />
        <span className={s.switchTrack} aria-hidden="true" />
        <span>{label}</span>
      </label>
      {hint ? <div className={s.hint} style={{ marginTop: 4, paddingLeft: 44 }}>{hint}</div> : null}
    </div>
  )
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

/** Birkaç seçenekli yatay seçici (ör. "Yeni" rozeti: manuel / otomatik / kapalı). */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className={s.field}>
      <span className={s.label}>{label}</span>
      <div className={s.segmented} role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
