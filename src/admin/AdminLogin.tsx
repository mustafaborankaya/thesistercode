import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { loginAdmin } from './adminAuth'
import { AS } from './adminStrings'
import styles from './admin.module.css'

interface AdminLoginProps {
  onLogin: () => void
}

/**
 * `/admin/giris` — kullanıcı adı + parola. Doğrulama backend API'de (`POST /api/auth/login`, httpOnly çerez);
 * API'ye ulaşılamayan geliştirme ortamında `siteSettings.admin` ile yerel kontrol yapılır (bkz. adminAuth.ts).
 */
export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    const result = await loginAdmin(username, password)
    setPending(false)
    if (result.ok) onLogin()
    else setError(result.message || AS.login.error)
  }

  return (
    <div className={styles.loginShell}>
      <form className={styles.loginCard} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.loginTitle}>{AS.login.title}</h1>
        <Field
          label={AS.login.usernameLabel}
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setError(null)
          }}
        />
        <Field
          label={AS.login.passwordLabel}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
          error={error}
        />
        <Button type="submit" block disabled={pending}>
          {pending ? '…' : AS.login.submit}
        </Button>
        <p className={styles.loginHint}>{AS.login.hint}</p>
      </form>
    </div>
  )
}
