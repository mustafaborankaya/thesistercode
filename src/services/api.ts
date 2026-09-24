/**
 * Backend API istemcisi (https://teshvikiye.com/api — Node/Express, Passenger).
 * Aynı origin üzerinden `/api` öneki kullanılır; oturumlar httpOnly çerezlerle taşınır (credentials: include).
 * Geliştirmede VITE_API_URL ile başka bir adres verilebilir (örn. http://localhost:3000).
 */

export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** multipart yükleme için FormData; JSON gövdesiyle birlikte kullanılmaz. */
  form?: FormData
  signal?: AbortSignal
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { method: opts.method ?? 'GET', headers, body, credentials: 'include', signal: opts.signal })
  } catch {
    throw new ApiError(0, 'network', 'Sunucuya ulaşılamadı.')
  }
  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.message ?? 'Beklenmeyen bir hata oluştu.')
  }
  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** API'nin erişilebilir olup olmadığı — mağaza yerel demo verisine geri düşmek için kullanır. */
export async function apiAvailable(timeoutMs = 2500): Promise<boolean> {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await api<{ ok: boolean }>('/health', { signal: ctrl.signal })
    return !!r?.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(t)
  }
}
