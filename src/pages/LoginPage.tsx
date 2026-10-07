import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/account/AuthLayout'
import { PasswordField } from '../components/account/PasswordField'
import { Button } from '../components/ui/Button'
import { Checkbox, Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { isApiMode } from '../data/remote'
import { S } from '../i18n'
import { readJSON, removeKey, storageKeys, writeJSON } from '../lib/storage'
import { useAccount } from '../state/AccountContext'
import authStyles from './Auth.module.css'

interface LoginValues {
  email: string
  password: string
}

type LoginErrors = Partial<Record<keyof LoginValues, string>>

/** "Beni hatırla" ile kaydedilmiş e-posta (yoksa boş). Parola asla saklanmaz. */
function rememberedEmail(): string {
  const v = readJSON<unknown>(storageKeys.rememberEmail, '')
  return typeof v === 'string' ? v : ''
}

export function LoginPage() {
  const { isLoggedIn, login } = useAccount()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState<LoginValues>(() => ({ email: rememberedEmail(), password: '' }))
  // Varsayılan işaretsiz; önceki girişte "Beni hatırla" seçildiyse (e-posta kayıtlı) işaretli gelir.
  const [remember, setRemember] = useState(() => rememberedEmail() !== '')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Başarılı girişten hemen sonra da isLoggedIn true olur; kendi navigate'imizin
  // render-guard tarafından ezilmemesi için bunu işaretliyoruz.
  const justLoggedIn = useRef(false)

  if (isLoggedIn && !justLoggedIn.current) {
    return <Navigate to="/hesap" replace />
  }

  const passwordReset = (location.state as { passwordReset?: boolean } | null)?.passwordReset

  function update(field: keyof LoginValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    const nextErrors: LoginErrors = {}
    if (!values.email.trim()) nextErrors.email = S.checkout.requiredField
    if (!values.password) nextErrors.password = S.checkout.requiredField
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      document.getElementById(nextErrors.email ? 'login-email' : 'login-password')?.focus()
      return
    }
    setSubmitError(null)
    setPending(true)
    const result = await login({ ...values, remember })
    setPending(false)
    if (result.ok) {
      if (remember) writeJSON(storageKeys.rememberEmail, values.email.trim())
      else removeKey(storageKeys.rememberEmail)
      justLoggedIn.current = true
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? '/hesap', { replace: true })
      return
    }
    switch (result.error) {
      case 'invalid-email':
        setSubmitError(S.checkout.invalidEmail)
        break
      case 'password-short':
        setSubmitError(S.checkout.requiredField)
        break
      case 'not-found':
        setSubmitError(result.message ?? S.account.loginFailed)
        break
      case 'rate-limited':
        setSubmitError(result.message ?? S.account.genericError)
        break
      default:
        setSubmitError(result.message ?? S.account.genericError)
    }
  }

  return (
    <AuthLayout
      title={S.account.login}
      lead={S.account.authLoginLead}
      footer={
        <>
          {S.account.noAccount}{' '}
          <Link to="/kayit" className="link">
            {S.header.createAccountOffer}
          </Link>
        </>
      }
    >
      <form className={authStyles.form} onSubmit={handleSubmit} noValidate>
        {passwordReset ? (
          <p role="status" className={authStyles.successNote}>
            <Icon name="check" size={16} />
            <span>{S.authFlow.resetSuccess}</span>
          </p>
        ) : null}
        <Field
          id="login-email"
          label={S.account.email}
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <PasswordField
          id="login-password"
          label={S.account.password}
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          onChange={(e) => update('password', e.target.value)}
        />
        <div>
          <div className={authStyles.rememberRow}>
            <Checkbox
              id="login-remember"
              label={S.account.rememberMe}
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              aria-describedby="login-remember-hint"
            />
            <Link to="/sifre-sifirla" className="link text-sm">
              {S.authFlow.forgotPasswordLink}
            </Link>
          </div>
          <p id="login-remember-hint" className={authStyles.rememberHint}>
            {S.account.rememberMeHint}
          </p>
        </div>
        {submitError ? (
          <div role="alert" className={authStyles.formError}>
            <Icon name="info" size={14} />
            <span>{submitError}</span>
          </div>
        ) : null}
        <Button type="submit" variant="primary" block disabled={pending}>
          {pending ? S.common.loading : S.account.login}
        </Button>
        <p className={authStyles.demoNote}>{isApiMode() ? S.api.accountNote : S.account.demoNote}</p>
      </form>
    </AuthLayout>
  )
}
