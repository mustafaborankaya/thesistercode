/** Ürün listesi / düzenleme ortak yardımcıları (bileşen dışı — hızlı yenileme kuralı için ayrı dosya). */
import { ApiError } from '../services/api'
import type { AdminProductPatch } from './adminApi'

/** Sunucu `updatedAt` gönderiyorsa eşzamanlı düzenleme koruması için `expectedUpdatedAt` eklenir (eski sunucu yok sayar). */
export function withExpected(p: { updatedAt?: string | null }, patch: AdminProductPatch): AdminProductPatch {
  return p.updatedAt ? { ...patch, expectedUpdatedAt: p.updatedAt } : patch
}

/** 409 — ürün başka bir yerde değiştirildi (eşzamanlı düzenleme). */
export function isConflict(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409 && e.code !== 'insufficient_stock'
}
