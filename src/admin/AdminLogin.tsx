import { useState, type FormEvent } from 'react'
import { loginAdmin } from './adminAuth'
import { AS } from './adminStrings'
import { Btn } from './ui/Button'
import { TextField } from './ui/Form'
import ui from './ui/ui.module.css'
import styles from './admin.module.css'

interface AdminLoginProps {
  onLogin: () => void
}

/**
 * `/admin/giris` — kullanıcı adı + parola. Doğrulama backend API'de (`POST /api/auth/login`, httpOnly çerez);
 * API'ye ulaşılamayan geliştirme ortamında `.env.local` kimliğiyle yerel kontrol yapılır (bkz. adminAuth.ts).
 * Girişten sonra, girişe yönlendirilmeden önceki adrese dönülür (bkz. AdminApp → RedirectAfterLogin).
 */
export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <div className={[ui.theme, styles.loginShell].join(' ')}>
      <main className={styles.loginCard}>
        <div className={styles.loginBrand}>
          <span className={styles.loginMark} aria-hidden="true">
            T
          </span>
          <span className={styles.loginBrandName}>{AS.headerTitle}</span>
        </div>
        <h1 className={styles.loginTitle}>{AS.login.title}</h1>
        <p className={styles.loginSub}>{AS.login.subtitle}</p>
        <form className={ui.stack} onSubmit={handleSubmit} noValidate>
          <TextField
            label={AS.login.usernameLabel}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setError(null)
            }}
          />
          <TextField
            label={AS.login.passwordLabel}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            error={error}
          />
          <label className={ui.check}>
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            <span>{AS.login.showPassword}</span>
          </label>
          <Btn type="submit" variant="primary" loading={pending} style={{ width: '100%', minHeight: 42 }}>
            {AS.login.submit}
          </Btn>
        </form>
      </main>
    </div>
  )
}
