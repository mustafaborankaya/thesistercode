import { useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { exportAdminData, importAdminData, useApiMode } from '../adminApi'
import { deleteMediaBlob, exportAdminJson, importAdminJson, listMediaBlobNames, resetAdminData } from '../adminStore'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

/** `/admin/veri` — API varsa JSON dışa/içe aktarma (ürün + içerik + ayar, bkz. api/README.md "Bilinen sınırlar"); yoksa yerel override'ları dışa/içe aktarma + sıfırlama. */
export function DataPage() {
  return useApiMode ? <ApiDataPage /> : <LocalDataPage />
}

/* ==================== API modu ==================== */

function ApiDataPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExport() {
    setExportError(null)
    try {
      const payload = await exportAdminData()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `teshvikiye-api-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setExportError(apiErrorMessage(e))
    }
  }

  async function handleImportFile(file: File) {
    setImportResult(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      setImportResult({ ok: false, text: 'Geçersiz JSON dosyası.' })
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const format = (parsed as { format?: string } | null)?.format
    if (format !== 'teshvikiye-api-export') {
      setImportResult({ ok: false, text: 'Bu dosya API dışa aktarma biçiminde değil (yerel panel dışa aktarımı burada kullanılamaz).' })
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    try {
      await importAdminData(parsed)
      setImportResult({ ok: true, text: 'İçe aktarıldı.' })
    } catch (e) {
      setImportResult({ ok: false, text: apiErrorMessage(e) })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.data.title}</h1>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.data.exportTitle}</div>
        <p className="text-soft" style={{ marginBottom: 'var(--sp-3)' }}>
          Ürün katalogu, içerik alanları, ayarlar ve marka görselleri indirilir. Kullanıcılar, müşteriler ve siparişler kapsam dışıdır (bkz. api/README.md).
        </p>
        <Button variant="secondary" onClick={() => void handleExport()}>
          {AS.data.exportButton}
        </Button>
        {exportError ? (
          <p role="alert" className="text-sm" style={{ marginTop: 'var(--sp-2)' }}>
            {exportError}
          </p>
        ) : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.data.importTitle}</div>
        <p className="text-soft" style={{ marginBottom: 'var(--sp-3)' }}>
          Yalnızca bu sayfadan indirilmiş bir dosya (`teshvikiye-api-export`) yüklenebilir. İçe aktarma ürün katalogunu TAMAMEN DEĞİŞTİRİR — yalnızca sahip (owner) yapabilir.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
          }}
        />
        {importResult ? (
          <div className={styles.saveMessage} style={{ marginTop: 'var(--sp-3)' }}>
            <Icon name={importResult.ok ? 'check' : 'info'} size={16} />
            <span>{importResult.text}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ==================== Yerel (localStorage) modu — yalnızca API yokken (DEV) ==================== */

function LocalDataPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  async function handleExport() {
    const json = await exportAdminJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `the-sister-code-admin-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(file: File) {
    const text = await file.text()
    const result = await importAdminJson(text)
    setImportResult(result.ok ? { ok: true, text: AS.data.importSuccess(result.mediaCount) } : { ok: false, text: AS.data.importError(result.error) })
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleReset() {
    resetAdminData()
    for (const name of await listMediaBlobNames()) {
      await deleteMediaBlob(name)
    }
    setConfirmingReset(false)
    setResetDone(true)
    setImportResult(null)
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.data.title}</h1>
      </div>
      <p className={styles.demoNotice}>{AS.demoNotice}</p>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.data.exportTitle}</div>
        <p className="text-soft" style={{ marginBottom: 'var(--sp-3)' }}>
          {AS.data.exportHint}
        </p>
        <Button variant="secondary" onClick={() => void handleExport()}>
          {AS.data.exportButton}
        </Button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.data.importTitle}</div>
        <p className="text-soft" style={{ marginBottom: 'var(--sp-3)' }}>
          {AS.data.importHint}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
          }}
        />
        {importResult ? (
          <div className={styles.saveMessage} style={{ marginTop: 'var(--sp-3)' }}>
            <Icon name={importResult.ok ? 'check' : 'info'} size={16} />
            <span>{importResult.text}</span>
            {importResult.ok ? (
              <>
                <a className="link" href="/" target="_blank" rel="noopener noreferrer">
                  {AS.save.openStore}
                </a>
                <button type="button" className="link" onClick={() => window.location.reload()}>
                  {AS.save.reloadPage}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.data.resetTitle}</div>
        <p className="text-soft" style={{ marginBottom: 'var(--sp-3)' }}>
          {AS.data.resetHint}
        </p>
        {resetDone ? (
          <div className={styles.saveMessage}>
            <Icon name="check" size={16} />
            <span>{AS.data.resetDone}</span>
            <a className="link" href="/" target="_blank" rel="noopener noreferrer">
              {AS.save.openStore}
            </a>
            <button type="button" className="link" onClick={() => window.location.reload()}>
              {AS.save.reloadPage}
            </button>
          </div>
        ) : confirmingReset ? (
          <div className={styles.twoStepConfirm}>
            <span>{AS.data.resetConfirmPrompt}</span>
            <Button variant="primary" small onClick={() => void handleReset()}>
              {AS.data.resetConfirmYes}
            </Button>
            <Button variant="ghost" small onClick={() => setConfirmingReset(false)}>
              {AS.data.resetConfirmNo}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmingReset(true)}>
            {AS.data.resetButton}
          </Button>
        )}
      </div>
    </div>
  )
}
