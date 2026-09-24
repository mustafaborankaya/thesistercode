import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../components/account/AuthLayout'
import { Icon } from '../components/ui/Icon'
import { S } from '../i18n'
import { verifyEmailToken, type SimpleResult } from '../services/auth'
import authStyles from './Auth.module.css'

/** `/hesap/dogrula` — yüklenince `?token=`'ı `POST /account/verify-email`'a gönderir ve sonucu gösterir. */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending')
  const [message, setMessage] = useState<string | null>(null)
  // Jeton TEK KULLANIMLIKTIR (bkz. api/src/routes/account.js) — React StrictMode (yalnızca DEV) efekti
  // mount'ta iki kez çalışır. Yalnızca "başlatıldı mı" işaretlemek yetmez: ilk çalışma temizlenince
  // (cancelled=true) o çalışmanın `.then`'i sonucu sessizce atar ve sayfa "Yükleniyor…" da kalır.
  // Bunun yerine PROMISE'İN KENDİSİ paylaşılır (tek POST) ve HER çalışma kendi `cancelled` bayrağıyla
  // sonuca abone olur — StrictMode'un gerçekten kalıcı olan (ikinci) çalışması sonucu işleyebilir.
  const promiseRef = useRef<Promise<SimpleResult> | null>(null)

  useEffect(() => {
    if (!token) {
      setState('error')
      return
    }
    if (!promiseRef.current) promiseRef.current = verifyEmailToken(token)
    let cancelled = false
    promiseRef.current.then((result) => {
      if (cancelled) return
      if (result.ok) {
        setState('ok')
      } else {
        setState('error')
        setMessage(result.error === 'invalid_token' ? S.authFlow.verifyFailure : result.message)
      }
    })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <AuthLayout
      title={S.authFlow.verifyTitle}
      lead={state === 'pending' ? S.authFlow.verifyPending : state === 'ok' ? S.authFlow.verifySuccess : (message ?? S.authFlow.verifyFailure)}
      footer={
        <Link to="/giris" className="link">
          {S.authFlow.backToLogin}
        </Link>
      }
    >
      <p role="status" className={state === 'ok' ? authStyles.successNote : undefined}>
        {state === 'pending' ? (
          S.common.loading
        ) : state === 'ok' ? (
          <>
            <Icon name="check" size={16} />
            <span>{S.authFlow.verifySuccess}</span>
          </>
        ) : (
          <span role="alert">{message ?? S.authFlow.verifyFailure}</span>
        )}
      </p>
    </AuthLayout>
  )
}
