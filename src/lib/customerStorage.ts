/** Customer mutations must fail visibly when browser persistence is unavailable. */
export const CUSTOMER_CHANGED = 'tsc:customer-changed'

export function persistCustomerData(key: string, value: unknown): void {
  try {
    const json = JSON.stringify(value)
    window.localStorage.setItem(key, json)
    if (window.localStorage.getItem(key) !== json) throw new Error('write failed')
  } catch {
    throw new Error('Bilgiler kaydedilemedi. Tarayıcı depolama iznini ve boş alanını kontrol edip tekrar deneyin.')
  }
  window.dispatchEvent(new Event(CUSTOMER_CHANGED))
}

export function subscribeCustomer(listener: () => void): () => void {
  window.addEventListener(CUSTOMER_CHANGED, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(CUSTOMER_CHANGED, listener)
    window.removeEventListener('storage', listener)
  }
}
