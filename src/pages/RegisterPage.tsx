import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/account/AuthLayout'
import { PasswordField } from '../components/account/PasswordField'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { S } from '../i18n'
import { EMAIL_RE, MIN_PASSWORD } from '../services/auth'
import { useAccount } from '../state/AccountContext'
import authStyles from './Auth.module.css'

interface RegisterValues {
  name: string
  email: string
  password: string
}

type RegisterErrors = Partial<Record<keyof RegisterValues, string>>

export function RegisterPage() {
  const { isLoggedIn, register } = useAccount()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState<RegisterValues>({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const justRegistered = useRef(false)

  if (isLoggedIn && !justRegistered.current) {
    return <Navigate to="/hesap" replace />
  }

  function update(field: keyof RegisterValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    const nextErrors: RegisterErrors = {}
    if (!values.name.trim()) nextErrors.name = S.checkout.requiredField
    if (!values.email.trim()) nextErrors.email = S.checkout.requiredField
    else if (!EMAIL_RE.test(values.email.trim())) nextErrors.email = S.checkout.invalidEmail
    if (!values.password) nextErrors.password = S.checkout.requiredField
    else if (values.password.length < MIN_PASSWORD) nextErrors.password = S.account.passwordShort
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const order: (keyof RegisterValues)[] = ['name', 'email', 'password']
      const firstKey = order.find((k) => nextErrors[k])
      if (firstKey) document.getElementById(`register-${firstKey}`)?.focus()
      return
    }
    setSubmitError(null)
    setPending(true)
    const result = await register(values)
    setPending(false)
    if (result.ok) {
      justRegistered.current = true
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? '/hesap', { state: { registered: true } })
      return
    }
    switch (result.error) {
      case 'invalid-email':
        setSubmitError(S.checkout.invalidEmail)
        break
      case 'password-short':
        setSubmitError(S.account.passwordShort)
        break
      default:
        setSubmitError(S.account.genericError)
    }
  }

  return (
    <AuthLayout
      title={S.account.register}
      lead={S.account.authRegisterLead}
      footer={
        <>
          {S.account.haveAccount}{' '}
          <Link to="/giris" className="link">
            {S.account.login}
          </Link>
        </>
      }
    >
      <form className={authStyles.form} onSubmit={handleSubmit} noValidate>
        <Field
          id="register-name"
          label={S.account.name}
          autoComplete="name"
          value={values.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
        />
        <Field
          id="register-email"
          label={S.account.email}
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <PasswordField
          id="register-password"
          label={S.account.password}
          hint={S.account.passwordHint}
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          onChange={(e) => update('password', e.target.value)}
        />
        {submitError ? (
          <div role="alert" className={authStyles.formError}>
            <Icon name="info" size={14} />
            <span>{submitError}</span>
          </div>
        ) : null}
        <Button type="submit" variant="primary" block disabled={pending}>
          {pending ? S.common.loading : S.account.register}
        </Button>
        <p className={authStyles.demoNote}>{S.account.demoNote}</p>
      </form>
    </AuthLayout>
  )
}
