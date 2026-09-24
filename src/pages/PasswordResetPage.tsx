import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../components/account/AuthLayout'
import { PasswordField } from '../components/account/PasswordField'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { S } from '../i18n'
import { EMAIL_RE, MIN_PASSWORD, requestPasswordReset, resetPassword } from '../services/auth'
import authStyles from './Auth.module.css'

/**
 * `/sifre-sifirla` — token yoksa e-posta ile sıfırlama bağlantısı ister (`POST /account/password/forgot`),
 * token varsa yeni parola formu gösterir (`POST /account/password/reset`). Bağlantılar e-postada
 * `https://teshvikiye.com[/en]/sifre-sifirla?token=…` biçiminde gelir.
 */
export function PasswordResetPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  return token ? <ResetForm token={token} /> : <ForgotForm />
}

function ForgotForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) {
      setError(S.checkout.invalidEmail)
      return
    }
    setError(null)
    setPending(true)
    const result = await requestPasswordReset(email.trim())
    setPending(false)
    // Sunucu her zaman ok döner (e-postanın var olup olmadığını sızdırmaz); yalnızca ağ hatasında mesaj gösterilir.
    if (result.ok) setSent(true)
    else setError(result.message)
  }

  if (sent) {
    return (
      <AuthLayout title={S.authFlow.forgotSentTitle} lead={S.authFlow.forgotSentText} footer={<Link to="/giris" className="link">{S.authFlow.backToLogin}</Link>}>
        <p role="status" className={authStyles.successNote}>
          <Icon name="check" size={16} />
          <span>{S.authFlow.forgotSentText}</span>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={S.authFlow.forgotTitle}
      lead={S.authFlow.forgotLead}
      footer={
        <Link to="/giris" className="link">
          {S.authFlow.backToLogin}
        </Link>
      }
    >
      <form className={authStyles.form} onSubmit={handleSubmit} noValidate>
        <Field id="forgot-email" label={S.account.email} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error ? (
          <div role="alert" className={authStyles.formError}>
            <Icon name="info" size={14} />
            <span>{error}</span>
          </div>
        ) : null}
        <Button type="submit" variant="primary" block disabled={pending}>
          {pending ? S.common.loading : S.authFlow.forgotSubmit}
        </Button>
      </form>
    </AuthLayout>
  )
}

function ResetForm({ token }: { token: string }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [invalidToken, setInvalidToken] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) {
      setError(S.account.passwordShort)
      return
    }
    setError(null)
    setPending(true)
    const result = await resetPassword(token, password)
    setPending(false)
    if (result.ok) {
      navigate('/giris', { state: { passwordReset: true } })
      return
    }
    if (result.error === 'invalid_token') setInvalidToken(true)
    else setError(result.message)
  }

  if (invalidToken) {
    return (
      <AuthLayout title={S.authFlow.resetTitle} lead={S.authFlow.resetInvalidToken} footer={<Link to="/giris" className="link">{S.authFlow.backToLogin}</Link>}>
        <Button variant="primary" block to="/sifre-sifirla">
          {S.authFlow.requestNewLink}
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={S.authFlow.resetTitle}
      lead={S.authFlow.resetLead}
      footer={
        <Link to="/giris" className="link">
          {S.authFlow.backToLogin}
        </Link>
      }
    >
      <form className={authStyles.form} onSubmit={handleSubmit} noValidate>
        <PasswordField id="reset-password" label={S.authFlow.newPasswordLabel} hint={S.account.passwordHint} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? (
          <div role="alert" className={authStyles.formError}>
            <Icon name="info" size={14} />
            <span>{error}</span>
          </div>
        ) : null}
        <Button type="submit" variant="primary" block disabled={pending}>
          {pending ? S.common.loading : S.authFlow.resetSubmit}
        </Button>
      </form>
    </AuthLayout>
  )
}
