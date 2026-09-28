import { useRef, useState } from 'react'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { exportAdminData, importAdminData, useApiMode } from '../adminApi'
import { deleteMediaBlob, exportAdminJson, importAdminJson, listMediaBlobNames, resetAdminData } from '../adminStore'
import { AS } from '../adminStrings'
import { Btn } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { FormSection } from '../ui/FormSection'
import { Notice, PageHeader } from '../ui/Page'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'

function download(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const today = () => new Date().toISOString().slice(0, 10)

/** `/admin/veri` — API varsa JSON dışa/içe aktarma (ürün + içerik + ayar); yoksa yerel override'lar + sıfırlama. */
export function DataPage() {
  return (
    <div style={{ maxWidth: 880 }}>
      <PageHeader title={AS.data.title} description={AS.data.subtitle} />
      {useApiMode ? <ApiData /> : <LocalData />}
    </div>
  )
}

/* ==================== API modu ==================== */

function ApiData() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ name: string; payload: unknown } | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const payload = await exportAdminData()
      download(JSON.stringify(payload, null, 2), `teshvikiye-api-export-${today()}.json`)
      toast.success(AS.data.exported)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  async function pickFile(file: File) {
    if (fileRef.current) fileRef.current.value = ''
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      toast.error(AS.data.invalidJson)
      return
    }
    if ((parsed as { format?: string } | null)?.format !== 'teshvikiye-api-export') {
      toast.error(AS.data.wrongFormat)
      return
    }
    setPendingImport({ name: file.name, payload: parsed })
  }

  async function confirmImport() {
    if (!pendingImport) return
    setImporting(true)
    try {
      await importAdminData(pendingImport.payload)
      toast.success(AS.data.importDone)
      setPendingImport(null)
    } catch (e) {
      toast.error(AS.data.importError(apiErrorMessage(e)))
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <FormSection title={AS.data.exportTitle} description={AS.data.exportDesc}>
        <Btn icon="upload" loading={exporting} onClick={() => void handleExport()}>
          {AS.data.exportButton}
        </Btn>
      </FormSection>
      <FormSection title={AS.data.importTitle} description={AS.data.importDesc}>
        <div className={ui.stack}>
          <Notice tone="warning">{AS.data.ownerOnly}</Notice>
          <div>
            <Btn icon="data" onClick={() => fileRef.current?.click()}>
              {AS.data.importButton}
            </Btn>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-label={AS.data.importTitle}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void pickFile(f)
              }}
            />
          </div>
        </div>
      </FormSection>
      <ConfirmDialog
        open={pendingImport != null}
        title={AS.data.importConfirmTitle}
        message={pendingImport ? AS.data.importConfirmText(pendingImport.name) : ''}
        confirmLabel={AS.data.importConfirm}
        tone="danger"
        pending={importing}
        onCancel={() => setPendingImport(null)}
        onConfirm={() => void confirmImport()}
      />
    </>
  )
}

/* ==================== Yerel (localStorage) modu — yalnızca API yokken (DEV) ==================== */

function LocalData() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    download(await exportAdminJson(), `the-sister-code-admin-${today()}.json`)
    toast.success(AS.data.exported)
  }

  async function confirmImport() {
    if (!pendingImport) return
    setBusy(true)
    const result = await importAdminJson(await pendingImport.text())
    setBusy(false)
    setPendingImport(null)
    if (result.ok) toast.success(`${AS.data.importSuccess(result.mediaCount)} ${AS.save.savedLocal}`)
    else toast.error(AS.data.importError(result.error))
  }

  async function handleReset() {
    setBusy(true)
    resetAdminData()
    for (const name of await listMediaBlobNames()) await deleteMediaBlob(name)
    setBusy(false)
    setConfirmReset(false)
    toast.success(AS.data.resetDone)
  }

  return (
    <>
      <Notice tone="warning">{AS.demoNotice}</Notice>
      <FormSection title={AS.data.exportTitle} description={AS.data.exportHint}>
        <Btn icon="upload" onClick={() => void handleExport()}>
          {AS.data.exportButton}
        </Btn>
      </FormSection>
      <FormSection title={AS.data.importTitle} description={AS.data.importHint}>
        <Btn icon="data" onClick={() => fileRef.current?.click()}>
          {AS.data.importButton}
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label={AS.data.importTitle}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setPendingImport(f)
            if (fileRef.current) fileRef.current.value = ''
          }}
        />
      </FormSection>
      <FormSection title={AS.data.resetTitle} description={AS.data.resetHint}>
        <Btn variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>
          {AS.data.resetButton}
        </Btn>
      </FormSection>
      <ConfirmDialog
        open={pendingImport != null}
        title={AS.data.importConfirmTitle}
        message={pendingImport ? AS.data.importConfirmText(pendingImport.name) : ''}
        confirmLabel={AS.data.importConfirm}
        tone="danger"
        pending={busy}
        onCancel={() => setPendingImport(null)}
        onConfirm={() => void confirmImport()}
      />
      <ConfirmDialog
        open={confirmReset}
        title={AS.data.resetConfirmTitle}
        message={AS.data.resetHint}
        confirmLabel={AS.data.resetConfirmYes}
        tone="danger"
        pending={busy}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => void handleReset()}
      />
    </>
  )
}
