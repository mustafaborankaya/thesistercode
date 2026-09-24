/**
 * E-posta şablonları (TR/EN). Her şablon { subject, text, html } döndürür; HTML'de kullanıcı verisi kaçışlanır.
 * Marka görselleri/renkleri eklenmez (monokrom, sade metin ağırlıklı).
 */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function layout(title, bodyHtml, locale) {
  const footer = locale === 'en' ? 'This message was sent automatically by teshvikiye.com.' : 'Bu ileti teshvikiye.com tarafından otomatik gönderilmiştir.'
  return `<!doctype html><html lang="${locale}"><body style="margin:0;padding:32px;background:#fff;color:#000;font-family:Gill Sans,Arial,sans-serif;font-size:15px;line-height:1.5">
<div style="max-width:560px;margin:0 auto">
<p style="letter-spacing:.3em;text-transform:uppercase;font-size:12px;margin:0 0 24px">Teshvikiye</p>
<h1 style="font-weight:300;font-size:22px;letter-spacing:.06em;text-transform:uppercase;margin:0 0 16px">${esc(title)}</h1>
${bodyHtml}
<p style="margin-top:32px;border-top:1px solid #eee;padding-top:12px;font-size:12px;color:#666">${footer}</p>
</div></body></html>`
}

function money(n) {
  return `${Number(n).toFixed(2)} TL`
}

export const templates = {
  /** Sipariş onayı — müşteriye. `order`: services/orders.js formatOrder çıktısı (items dahil). */
  orderConfirmation({ order, locale = 'tr' }) {
    const en = locale === 'en'
    const d = order.delivery
    const t = order.totals
    const items = order.items ?? []
    const subject = en ? `Your order ${order.id} has been received` : `${order.id} numaralı siparişiniz alındı`
    const lines = items.map((i) => `${i.qty} × ${i.productName} (${i.colorLabel} / ${i.size}) — ${money(i.unitPrice * i.qty)}`)
    const shippingText = t.shipping == null ? (en ? 'to be confirmed' : 'bildirilecek') : money(t.shipping)
    const text = [
      en ? `Hello ${d.firstName},` : `Merhaba ${d.firstName},`,
      en ? `We have received your order ${order.id}.` : `${order.id} numaralı siparişinizi aldık.`,
      '',
      ...lines,
      '',
      `${en ? 'Subtotal' : 'Ara toplam'}: ${money(t.subtotal)}`,
      t.discountAmount > 0 ? `${en ? 'Member discount' : 'Üyelik indirimi'} (%${t.discountPercent}): -${money(t.discountAmount)}` : null,
      `${en ? 'Shipping' : 'Kargo'}: ${shippingText}`,
      `${en ? 'Total' : 'Genel toplam'}: ${money(t.total)}`,
      '',
      `${en ? 'Delivery address' : 'Teslimat adresi'}: ${d.firstName} ${d.lastName}, ${d.address}, ${d.district} / ${d.city} ${d.postalCode}, ${d.country}`,
      '',
      en ? 'We will notify you when your order is shipped.' : 'Siparişiniz kargoya verildiğinde sizi bilgilendireceğiz.',
    ]
      .filter((l) => l !== null)
      .join('\n')
    const html = layout(
      subject,
      `<p>${esc(en ? `Hello ${d.firstName},` : `Merhaba ${d.firstName},`)}</p>
<p>${esc(en ? `We have received your order ${order.id}.` : `${order.id} numaralı siparişinizi aldık.`)}</p>
<ul style="padding-left:18px">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
<table style="border-collapse:collapse;margin-top:12px">
<tr><td style="padding:2px 16px 2px 0">${en ? 'Subtotal' : 'Ara toplam'}</td><td>${esc(money(t.subtotal))}</td></tr>
${t.discountAmount > 0 ? `<tr><td style="padding:2px 16px 2px 0">${en ? 'Member discount' : 'Üyelik indirimi'} (%${esc(t.discountPercent)})</td><td>-${esc(money(t.discountAmount))}</td></tr>` : ''}
<tr><td style="padding:2px 16px 2px 0">${en ? 'Shipping' : 'Kargo'}</td><td>${esc(shippingText)}</td></tr>
<tr><td style="padding:8px 16px 2px 0;font-weight:600">${en ? 'Total' : 'Genel toplam'}</td><td style="padding-top:8px;font-weight:600">${esc(money(t.total))}</td></tr>
</table>
<p style="margin-top:16px">${esc(en ? 'Delivery address' : 'Teslimat adresi')}: ${esc(`${d.firstName} ${d.lastName}, ${d.address}, ${d.district} / ${d.city} ${d.postalCode}, ${d.country}`)}</p>
<p>${esc(en ? 'We will notify you when your order is shipped.' : 'Siparişiniz kargoya verildiğinde sizi bilgilendireceğiz.')}</p>`,
      locale,
    )
    return { subject, text, html }
  },

  /** Yeni sipariş bildirimi — yöneticiye (her zaman TR). */
  adminNewOrder({ order }) {
    const d = order.delivery
    const items = order.items ?? []
    const subject = `Yeni sipariş: ${order.id} — ${money(order.totals.total)}`
    const text = [
      `Yeni sipariş alındı: ${order.id}`,
      `${d.firstName} ${d.lastName} — ${order.contact.email} — ${order.contact.phone}`,
      `${d.address}, ${d.district} / ${d.city} ${d.postalCode}, ${d.country}`,
      d.note ? `Not: ${d.note}` : null,
      '',
      ...items.map((i) => `${i.qty} × ${i.productName} (${i.colorLabel} / ${i.size}) — ${money(i.unitPrice * i.qty)}`),
      '',
      `Ara toplam: ${money(order.totals.subtotal)}`,
      order.totals.discountAmount > 0 ? `Üyelik indirimi (%${order.totals.discountPercent}): -${money(order.totals.discountAmount)}` : null,
      `Toplam: ${money(order.totals.total)}`,
    ]
      .filter((l) => l !== null)
      .join('\n')
    const html = layout(subject, `<pre style="white-space:pre-wrap;font-family:inherit">${esc(text)}</pre>`, 'tr')
    return { subject, text, html }
  },

  /** Hoş geldin — hesap oluşturan müşteriye. */
  welcome({ name, locale = 'tr' }) {
    const en = locale === 'en'
    const subject = en ? 'Welcome to Teshvikiye' : "Teshvikiye'ye hoş geldiniz"
    const body = en
      ? `Hello ${name},\n\nYour account has been created. Your member discount is applied automatically in your cart.`
      : `Merhaba ${name},\n\nHesabınız oluşturuldu. Üyelik indiriminiz sepetinizde otomatik uygulanır.`
    return { subject, text: body, html: layout(subject, `<p>${esc(body).replace(/\n/g, '<br>')}</p>`, locale) }
  },

  /** Parola sıfırlama bağlantısı. */
  passwordReset({ name, resetUrl, locale = 'tr' }) {
    const en = locale === 'en'
    const subject = en ? 'Reset your password' : 'Parolanızı sıfırlayın'
    const body = en
      ? `Hello ${name},\n\nUse the link below to set a new password. The link is valid for 60 minutes.\n${resetUrl}\n\nIf you did not request this, you can ignore this message.`
      : `Merhaba ${name},\n\nYeni bir parola belirlemek için aşağıdaki bağlantıyı kullanın. Bağlantı 60 dakika geçerlidir.\n${resetUrl}\n\nBu isteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz.`
    return { subject, text: body, html: layout(subject, `<p>${esc(body).replace(/\n/g, '<br>')}</p>`, locale) }
  },

  /** E-posta doğrulama bağlantısı. */
  verifyEmail({ name, verifyUrl, locale = 'tr' }) {
    const en = locale === 'en'
    const subject = en ? 'Verify your e-mail address' : 'E-posta adresinizi doğrulayın'
    const body = en
      ? `Hello ${name},\n\nPlease confirm your e-mail address:\n${verifyUrl}`
      : `Merhaba ${name},\n\nLütfen e-posta adresinizi doğrulayın:\n${verifyUrl}`
    return { subject, text: body, html: layout(subject, `<p>${esc(body).replace(/\n/g, '<br>')}</p>`, locale) }
  },
}
