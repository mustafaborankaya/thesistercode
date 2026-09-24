/**
 * E-POSTA SERVİSİ — sağlayıcı soyutlaması.
 *
 * MAIL_PROVIDER (.env):
 *   none  → gönderim yapılmaz, yalnızca mail_log'a 'skipped' yazılır (varsayılan; SMTP kurulana kadar)
 *   log   → gönderim yapılmaz, içerik sunucu günlüğüne yazılır (geliştirme)
 *   smtp  → nodemailer ile SMTP (cPanel e-posta hesabı: SMTP_HOST=mail.teshvikiye.com, SMTP_PORT=465, SMTP_SECURE=1,
 *           SMTP_USER=bilgi@teshvikiye.com, SMTP_PASS=…, MAIL_FROM="Teshvikiye <bilgi@teshvikiye.com>", ADMIN_NOTIFY_EMAIL=…)
 *
 * Gönderim hiçbir zaman ana isteği başarısız kılmaz: hata yakalanır, mail_log'a 'failed' yazılır, istek devam eder.
 * nodemailer yalnızca smtp modunda dinamik olarak yüklenir (bağımlılık yoksa 'failed' kaydı düşer, uygulama çalışır).
 */
import { templates } from '../../templates/mail.js'
import { pool } from '../db.js'

const cfg = () => ({
  provider: (process.env.MAIL_PROVIDER || 'none').toLowerCase(),
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 465),
  secure: (process.env.SMTP_SECURE ?? '1') !== '0',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@teshvikiye.com',
  adminNotify: process.env.ADMIN_NOTIFY_EMAIL || '',
})

let transporterPromise = null

async function getTransporter() {
  if (transporterPromise) return transporterPromise
  const c = cfg()
  transporterPromise = import('nodemailer').then((m) => {
    const nodemailer = m.default ?? m
    return nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: c.user ? { user: c.user, pass: c.pass } : undefined })
  })
  return transporterPromise
}

async function logMail({ to, template, subject, locale, status, provider, error, refType, refId, sentAt }) {
  try {
    await pool.execute(
      `INSERT INTO mail_log (to_email, template, subject, locale, status, provider, error, ref_type, ref_id, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [to, template, subject.slice(0, 255), locale, status, provider, error ? String(error).slice(0, 500) : null, refType ?? null, refId ?? null, sentAt ?? null],
    )
  } catch {
    /* günlük yazılamasa da gönderim akışı bozulmaz */
  }
}

/**
 * Şablonla e-posta gönderir. Dönüş: { ok, status }. Asla fırlatmaz.
 * @param {{ to: string, template: keyof typeof templates, data: object, locale?: 'tr'|'en', refType?: string, refId?: string }} p
 */
export async function sendMail({ to, template, data, locale = 'tr', refType, refId }) {
  const c = cfg()
  const tpl = templates[template]
  if (!tpl || !to) return { ok: false, status: 'failed' }
  const { subject, text, html } = tpl({ ...data, locale })
  const base = { to, template, subject, locale, provider: c.provider, refType, refId }

  if (c.provider === 'none') {
    await logMail({ ...base, status: 'skipped' })
    return { ok: true, status: 'skipped' }
  }
  if (c.provider === 'log') {
    console.log(`[mail:log] → ${to} | ${subject}\n${text}`)
    await logMail({ ...base, status: 'sent', sentAt: new Date() })
    return { ok: true, status: 'sent' }
  }
  if (c.provider === 'smtp') {
    if (!c.host) {
      await logMail({ ...base, status: 'failed', error: 'SMTP_HOST tanımsız' })
      return { ok: false, status: 'failed' }
    }
    try {
      const transporter = await getTransporter()
      await transporter.sendMail({ from: c.from, to, subject, text, html })
      await logMail({ ...base, status: 'sent', sentAt: new Date() })
      return { ok: true, status: 'sent' }
    } catch (err) {
      await logMail({ ...base, status: 'failed', error: err?.message || 'gönderim hatası' })
      return { ok: false, status: 'failed' }
    }
  }
  await logMail({ ...base, status: 'failed', error: `bilinmeyen sağlayıcı: ${c.provider}` })
  return { ok: false, status: 'failed' }
}

/** Yöneticiye bildirim (ADMIN_NOTIFY_EMAIL tanımlıysa). */
export async function notifyAdmin(template, data, ref) {
  const c = cfg()
  if (!c.adminNotify) return { ok: true, status: 'skipped' }
  return sendMail({ to: c.adminNotify, template, data, locale: 'tr', ...ref })
}

/** Sağlayıcı yapılandırması özeti (health/admin ekranı için; gizli değer içermez). */
export function mailStatus() {
  const c = cfg()
  return { provider: c.provider, configured: c.provider === 'none' || (c.provider === 'smtp' ? !!(c.host && c.user) : true), from: c.provider === 'none' ? null : c.from }
}
