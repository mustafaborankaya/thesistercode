import { siteSettings } from '../config/settings'
import { locale, localeMeta } from '../i18n'

const { currency } = siteSettings

const numberFormat = new Intl.NumberFormat(localeMeta[locale].intlLocale, {
  minimumFractionDigits: currency.decimals,
  maximumFractionDigits: currency.decimals,
})

/** Demo fiyatı merkezi para birimi ayarına göre biçimler: 2.450,00 TL */
export function formatPrice(amount: number): string {
  const n = numberFormat.format(amount)
  return currency.position === 'suffix' ? `${n} ${currency.symbol}` : `${currency.symbol}${n}`
}

export function formatPercent(p: number): string {
  return `%${p}`
}
