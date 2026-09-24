import { useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { deleteMediaBlob, exportAdminJson, importAdminJson, listMediaBlobNames, resetAdminData } from '../adminStore'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

/** `/admin/veri` — JSON dışa/içe aktarma ve tüm override'ları sıfırlama. */
export function DataPage() {
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
