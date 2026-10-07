/**
 * %10 teklif panelinin oturum durumu.
 * - `dismissed`: kullanıcı X/Escape ile kapattı ya da "Hesap Oluştur"a geçti → bir daha kendiliğinden açılmaz.
 * - `autoShown`: bu oturumda kendiliğinden kaç kez gösterildi. Başka panel/rota nedeniyle kesilen teklif,
 *   kullanıcı kapatmadıysa en fazla MAX_AUTO_SHOWS kez yeniden sunulur; sürekli tekrar etmez.
 * Önizleme modlarında (ilk ziyaret / içerik) durum bellekte tutulur, sessionStorage'a yazılmaz.
 */
import { contentPreview, firstVisitPreview } from '../../lib/preview'
import { readJSON, storageKeys, writeJSON } from '../../lib/storage'

export interface OfferState {
  dismissed: boolean
  autoShown: number
}

export const MAX_AUTO_SHOWS = 2

const empty: OfferState = { dismissed: false, autoShown: 0 }
let memory: OfferState = { ...empty }
const inMemory = firstVisitPreview || contentPreview

export function readOfferState(): OfferState {
  if (inMemory) return memory
  const stored = readJSON<Partial<OfferState>>(storageKeys.offerState, empty, 'session')
  return { dismissed: !!stored.dismissed, autoShown: Number(stored.autoShown) || 0 }
}

export function writeOfferState(patch: Partial<OfferState>): OfferState {
  const next = { ...readOfferState(), ...patch }
  if (inMemory) memory = next
  else writeJSON(storageKeys.offerState, next, 'session')
  return next
}
