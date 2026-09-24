import { en } from './en'
import { tr, type Strings } from './tr'

export type Locale = 'tr' | 'en'

const dictionaries: Record<Locale, Strings> = { tr, en }

/** Dil, URL önekinden belirlenir: `/en/...` İngilizce, diğer her şey Türkçe. Sayfa yüklenirken bir kez okunur. */
export function detectLocale(pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/'): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'tr'
}

export const locale: Locale = detectLocale()

/** Router basename: İngilizce sitede tüm rotalar `/en` altında çalışır. */
export const localeBasename: '/' | '/en' = locale === 'en' ? '/en' : '/'

export const localeMeta: Record<Locale, { lang: string; intlLocale: string; label: string }> = {
  tr: { lang: 'tr', intlLocale: 'tr-TR', label: 'Türkçe' },
  en: { lang: 'en', intlLocale: 'en-GB', label: 'English' },
}

/** Etkin dil sözlüğü. */
export const S: Strings = dictionaries[locale]

/** Aynı sayfanın diğer dildeki yolu (tam sayfa gezinme ile kullanılır). */
export function pathForLocale(target: Locale, pathname: string = window.location.pathname): string {
  const bare = pathname === '/en' ? '/' : pathname.startsWith('/en/') ? pathname.slice(3) : pathname
  return target === 'en' ? `/en${bare === '/' ? '' : bare}` || '/en' : bare || '/'
}
