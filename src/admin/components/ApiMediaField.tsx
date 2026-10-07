import { useState, type ReactNode } from 'react'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { uploadAdminMedia } from '../adminApi'
import { ImageSlot } from '../ui/ImageSlot'
import { useToast } from '../ui/toastContext'

interface ApiMediaFieldProps {
  /** Yüklenen dosyanın sunucudaki temel adı (ör. "urun-01-on" ya da "logo") — sunucu beyaz listesine uymalı. */
  name: string
  label: string
  src: string | null
  ratio?: string
  kind?: 'image' | 'video'
  meta?: string
  /** Yuva başlığı altındaki küçük rozet (kaynak: yüklenen / varsayılan). */
  badge?: ReactNode
  /** "Mağazada gör" bağlantısı — görselin kullanıldığı sayfa. */
  storeLink?: { href: string; label: string }
  /** Yükleme tamamlanınca dönen URL'yi kalıcı alana (ürün/marka) yazan çağrı — hata fırlatırsa yakalanır. */
  onUpload: (url: string) => Promise<void>
  /** Verilmezse Kaldır düğmesi gösterilmez. Hata fırlatırsa bildirim gösterilir. */
  onRemove?: () => Promise<void>
  /** Kaldırmadan önce onay isteyen sarmalayıcı (ör. ConfirmDialog) — verilirse onRemove yerine çağrılır. */
  onRequestRemove?: () => void
  savedMessage: string
  removedMessage?: string
  /** Kaldırma hatası için özel mesaj (ör. eski sunucu `null` kabul etmiyor). */
  removeErrorMessage?: (e: unknown) => string
  pendingExternal?: boolean
}

/** API modu görsel yuvası — dosya `POST /admin/upload`'a gider, dönen URL `onUpload` ile kaydedilir. */
export function ApiMediaField({ name, label, src, ratio, kind = 'image', meta, badge, storeLink, onUpload, onRemove, onRequestRemove, savedMessage, removedMessage, removeErrorMessage, pendingExternal }: ApiMediaFieldProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  async function handleFile(file: File) {
    setPending(true)
    setError(null)
    try {
      const res = await uploadAdminMedia(file, name)
      await onUpload(res.url)
      toast.success(savedMessage)
    } catch (e) {
      const msg = apiErrorMessage(e)
      setError(msg)
      toast.error(msg)
    } finally {
      setPending(false)
    }
  }

  async function handleRemove() {
    if (onRequestRemove) {
      onRequestRemove()
      return
    }
    if (!onRemove) return
    setPending(true)
    setError(null)
    try {
      await onRemove()
      if (removedMessage) toast.success(removedMessage)
    } catch (e) {
      const msg = removeErrorMessage ? removeErrorMessage(e) : apiErrorMessage(e)
      setError(msg)
      toast.error(msg)
    } finally {
      setPending(false)
    }
  }

  return (
    <ImageSlot
      label={label}
      src={src}
      ratio={ratio}
      kind={kind}
      meta={meta}
      badge={badge}
      storeLink={storeLink}
      pending={pending || pendingExternal}
      error={error}
      onFile={(f) => void handleFile(f)}
      onRemove={onRemove || onRequestRemove ? () => void handleRemove() : undefined}
    />
  )
}
