/**
 * Güvenli tarayıcı depolama yardımcıları.
 * Gizli pencere, engellenmiş depolama vb. durumlarda hata fırlatmaz; uygulama depolama olmadan da çalışır.
 */

function getStore(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readJSON<T>(key: string, fallback: T, kind: 'local' | 'session' = 'local'): T {
  const store = getStore(kind)
  if (!store) return fallback
  try {
    const raw = store.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown, kind: 'local' | 'session' = 'local'): void {
  const store = getStore(kind)
  if (!store) return
  try {
    store.setItem(key, JSON.stringify(value))
  } catch {
    /* depolama dolu ya da engelli — sessizce geç */
  }
}

export function removeKey(key: string, kind: 'local' | 'session' = 'local'): void {
  const store = getStore(kind)
  if (!store) return
  try {
    store.removeItem(key)
  } catch {
    /* yoksay */
  }
}

export const storageKeys = {
  cart: 'tsc.cart.v1',
  favorites: 'tsc.favorites.v1',
  account: 'tsc.account.v1',
  consent: 'tsc.consent.v1',
  offerState: 'tsc.offer.v2',
  collectionState: 'tsc.collection.state.v1',
  demoOrders: 'tsc.demo-orders.v1',
} as const
