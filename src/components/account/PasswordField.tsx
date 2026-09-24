import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { S } from '../../i18n'
import { IconButton } from '../ui/Button'
import { Field } from '../ui/Field'

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
}

/** Şifre alanı — göster/gizle kontrolü Field'ın adornment sahasında yer alır. */
export function PasswordField({ label, hint, error, style, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      type={visible ? 'text' : 'password'}
      autoComplete={rest.autoComplete ?? 'current-password'}
      style={{ paddingRight: 'calc(var(--tap) + var(--sp-4))', ...style }}
      adornment={
        <IconButton
          icon={visible ? 'eye-off' : 'eye'}
          label={visible ? S.account.hidePassword : S.account.showPassword}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          size={18}
        />
      }
      {...rest}
    />
  )
}
