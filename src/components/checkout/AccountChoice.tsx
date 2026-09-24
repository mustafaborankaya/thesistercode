import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PasswordField } from '../account/PasswordField'
import { S } from '../../i18n'
import { EMAIL_RE } from '../../services/auth'
import { useAccount } from '../../state/AccountContext'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Icon } from '../ui/Icon'
import styles from './Checkout.module.css'

interface AccountChoiceProps {
  email: string
  emailError?: string | null
  onEmailChange: (value: string) => void
}

interface LoginValues {
  email: string
  password: string
}

type LoginErrors = Partial<Record<keyof LoginValues, string>>

/**
 * Checkout'un iletişim adımının başındaki hesap seçimi.
 * Giriş yoksa misafir/giriş radyoları + inline giriş formu; girişliyse selamlama + çıkış.
 * NOT: checkout tek bir <form> olduğundan bu blok kendi <form>'unu açmaz — buton type="button".
 */
export function AccountChoice({ email, emailError, onEmailChange }: AccountChoiceProps) {
  const { isLoggedIn, account, login, logout } = useAccount()
  const [mode, setMode] = useState<'guest' | 'login'>('guest')
  const [loginValues, setLoginValues] = useState<LoginValues>({ email: '', password: '' })
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({})
  const [loginError, setLoginError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (isLoggedIn && account) {
      onEmailChange(account.email)
      setMode('guest')
    }
    // account.email değişince tekrar senkronla; onEmailChange her render'da yeni referans olabilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, account?.email])

  function updateLoginField(field: keyof LoginValues, value: string) {
    setLoginValues((v) => ({ ...v, [field]: value }))
    setLoginErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
  }

  async function handleInlineLogin() {
    if (pending) return
    const nextErrors: LoginErrors = {}
    if (!loginValues.email.trim()) nextErrors.email = S.checkout.requiredField
    else if (!EMAIL_RE.test(loginValues.email.trim())) nextErrors.email = S.checkout.invalidEmail
    if (!loginValues.password) nextErrors.password = S.checkout.requiredField
    if (Object.keys(nextErrors).length > 0) {
      setLoginErrors(nextErrors)
      document.getElementById(nextErrors.email ? 'checkout-login-email' : 'checkout-login-password')?.focus()
      return
    }
    setLoginError(null)
    setPending(true)
    const result = await login(loginValues)
    setPending(false)
    if (result.ok) {
      setLoginValues({ email: '', password: '' })
      return
    }
    switch (result.error) {
      case 'invalid-email':
        setLoginError(S.checkout.invalidEmail)
        break
      case 'not-found':
        setLoginError(S.account.loginFailed)
        break
      default:
        setLoginError(S.account.genericError)
    }
  }

  if (isLoggedIn && account) {
    return (
      <div className={styles.accountChoice}>
        <p className={styles.loggedInAs}>
          <Icon name="check" size={16} />
          <span>{S.checkout.loggedInAs(account.name)}</span>
        </p>
        <Field
          id="checkout-email"
          label={S.checkout.email}
          type="email"
          autoComplete="email"
          value={email}
          error={emailError}
          onChange={(e) => onEmailChange(e.target.value)}
        />
        <div>
          <Button type="button" variant="ghost" onClick={() => logout()}>
            {S.header.logout}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.accountChoice}>
      <div className={styles.radioGroup} role="radiogroup" aria-label={S.checkout.steps.contact}>
        <label className={styles.radioOption}>
          <input type="radio" name="checkout-account-mode" checked={mode === 'guest'} onChange={() => setMode('guest')} />
          {S.checkout.guest}
        </label>
        <label className={styles.radioOption}>
          <input type="radio" name="checkout-account-mode" checked={mode === 'login'} onChange={() => setMode('login')} />
          {S.checkout.loginInstead}
        </label>
      </div>

      {mode === 'login' ? (
        <div className={styles.inlineLogin}>
          <Field
            id="checkout-login-email"
            label={S.account.email}
            type="email"
            autoComplete="email"
            value={loginValues.email}
            error={loginErrors.email}
            onChange={(e) => updateLoginField('email', e.target.value)}
          />
          <PasswordField
            id="checkout-login-password"
            label={S.account.password}
            autoComplete="current-password"
            value={loginValues.password}
            error={loginErrors.password}
            onChange={(e) => updateLoginField('password', e.target.value)}
          />
          {loginError ? (
            <div role="alert" className={styles.formError}>
              <Icon name="info" size={14} />
              <span>{loginError}</span>
            </div>
          ) : null}
          <div>
            <Button type="button" variant="secondary" disabled={pending} onClick={handleInlineLogin}>
              {pending ? S.common.loading : S.account.login}
            </Button>
          </div>
        </div>
      ) : null}

      <Field
        id="checkout-email"
        label={S.checkout.email}
        type="email"
        autoComplete="email"
        value={email}
        error={emailError}
        onChange={(e) => onEmailChange(e.target.value)}
      />

      <p className={styles.noAccount}>
        {S.account.noAccount}{' '}
        <Link to="/kayit" className="link">
          {S.header.createAccountOffer}
        </Link>
      </p>
    </div>
  )
}
