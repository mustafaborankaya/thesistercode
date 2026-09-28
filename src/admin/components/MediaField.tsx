import { useState } from 'react'
import { mediaByName } from '../../data/media'
import { deleteMediaBlob, putMediaBlob } from '../adminStore'
import { AS } from '../adminStrings'
import { ImageSlot } from '../ui/ImageSlot'
import { useToast } from '../ui/toastContext'

interface MediaFieldProps {
  /** IndexedDB blob anahtarı — bkz. productMediaName / brandMediaNames. */
  name: string
  label: string
  ratio?: string
  kind?: 'image' | 'video'
  meta?: string
}

/**
 * Yerel demo modu (API yok) görsel yuvası: dosya IndexedDB'ye yazılır. `mediaOverrideUrls` reaktif
 * olmadığı için önizleme kendi state'inden güncellenir; mağazada görmek için sayfa yenilenmelidir.
 */
export function MediaField({ name, label, ratio, kind = 'image', meta }: MediaFieldProps) {
  const [src, setSrc] = useState<string | null>(() => mediaByName(name))
  const [pending, setPending] = useState(false)
  const toast = useToast()

  async function handleFile(file: File) {
    setPending(true)
    await putMediaBlob(name, file)
    setSrc(mediaByName(name))
    setPending(false)
    toast.success(AS.mediaPage.localSaved)
  }

  async function handleRemove() {
    setPending(true)
    await deleteMediaBlob(name)
    setSrc(mediaByName(name))
    setPending(false)
    toast.success(AS.mediaPage.localSaved)
  }

  return <ImageSlot label={label} src={src} ratio={ratio} kind={kind} meta={meta} pending={pending} onFile={(f) => void handleFile(f)} onRemove={() => void handleRemove()} />
}
