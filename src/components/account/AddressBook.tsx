import { useEffect, useId, useReducer, useRef, useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Checkbox, Field, TextareaField } from '../ui/Field'
import { S } from '../../i18n'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { ApiError } from '../../services/api'
import {
  addressDisplayLabel,
  addressesOnServer,
  listAddresses,
  loadAddresses,
  removeAddress,
  saveAddress,
  setDefaultAddress,
  subscribeCustomer,
  type AddressInput,
  type SavedAddress,
} from '../../services/customer'
import styles from './AddressBook.module.css'

type TextKey = Exclude<keyof AddressInput, 'isDefault'>
type LoadState = 'loading' | 'ready' | 'error'

const T = S.account.addressBook
const fields: { name: TextKey; label: string; autoComplete: string; type?: string }[] = [
  { name: 'label', label: T.label, autoComplete: 'off' },
  { name: 'firstName', label: S.checkout.firstName, autoComplete: 'given-name' },
  { name: 'lastName', label: S.checkout.lastName, autoComplete: 'family-name' },
  { name: 'phone', label: S.checkout.phone, autoComplete: 'tel', type: 'tel' },
  { name: 'address', label: T.address, autoComplete: 'street-address' },
  { name: 'district', label: S.checkout.district, autoComplete: 'address-level2' },
  { name: 'city', label: S.checkout.city, autoComplete: 'address-level1' },
  { name: 'postalCode', label: S.checkout.postalCode, autoComplete: 'postal-code' },
  { name: 'country', label: S.checkout.country, autoComplete: 'country-name' },
]

/** Hangi alanın isteğe bağlı olduğu: sunucu (API) posta kodunu ister, başlık isteğe bağlıdır; demo tersi. */
function optionalField(server: boolean): TextKey {
  return server ? 'label' : 'postalCode'
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'address_limit') return T.limit
    if (error.code === 'not_found') return T.gone
    return apiErrorMessage(error)
  }
  return error instanceof Error && error.message ? error.message : T.failed
}

export function AddressBook({ email }: { email: string }) {
  const server = addressesOnServer()
  const optional = optionalField(server)
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  const [loadState, setLoadState] = useState<LoadState>(server ? 'loading' : 'ready')
  const [editor, setEditor] = useState<{ address?: SavedAddress } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<TextKey, string>>>({})
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const firstField = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  const addresses = [...listAddresses(email)].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))

  useEffect(() => subscribeCustomer(refresh), [])
  useEffect(() => {
    if (!server) return
    let cancelled = false
    loadAddresses(email).then(
      () => { if (!cancelled) setLoadState('ready') },
      () => { if (!cancelled) setLoadState('error') },
    )
    return () => { cancelled = true }
  }, [email, server])
  useEffect(() => { if (editor) firstField.current?.focus() }, [editor])

  function retry() {
    setLoadState('loading')
    loadAddresses(email).then(() => setLoadState('ready'), () => setLoadState('error'))
  }

  function openEditor(address?: SavedAddress) {
    setErrors({})
    setFailure('')
    setNotice('')
    setDeletingId(null)
    setEditor({ address })
  }

  function finish(message: string) {
    refresh()
    setEditor(null)
    setDeletingId(null)
    setFailure('')
    setNotice(message)
    heading.current?.focus()
  }

  function report(error: unknown) {
    setNotice('')
    setFailure(errorText(error))
  }

  async function run(action: () => Promise<void>, message: string) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      finish(message)
    } catch (error) {
      report(error)
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const input = Object.fromEntries(fields.map(({ name }) => [name, String(data.get(name) ?? '').trim()])) as Omit<AddressInput, 'isDefault'>
    const nextErrors: Partial<Record<TextKey, string>> = {}
    for (const { name, label } of fields) {
      if (name !== optional && !input[name]) nextErrors[name] = T.fieldRequired(label)
    }
    if (input.phone && input.phone.replace(/\D/g, '').length < 10) nextErrors.phone = T.phoneInvalid
    setErrors(nextErrors)
    setFailure('')
    const invalid = fields.find(({ name }) => nextErrors[name])
    if (invalid) {
      const control = form.elements.namedItem(invalid.name)
      if (control instanceof HTMLElement) control.focus()
      return
    }
    const editing = editor?.address
    if (editing && !addresses.some((address) => address.id === editing.id)) {
      report(new Error(T.gone))
      return
    }
    void run(() => saveAddress(email, { ...input, isDefault: data.get('isDefault') === 'on' }, editing?.id), editing ? T.updated : T.saved)
  }

  const showLoading = server && loadState === 'loading' && addresses.length === 0

  return (
    <section className={styles.book} aria-labelledby={`${id}-title`} aria-busy={busy || showLoading}>
      <div className={styles.header}>
        <div>
          <h2 id={`${id}-title`} className={styles.title} ref={heading} tabIndex={-1}>{S.account.addresses}</h2>
          <p className={styles.note}>{server ? T.noteServer : T.noteLocal}</p>
        </div>
        {!editor && loadState !== 'error' && !showLoading && <Button variant="secondary" onClick={() => openEditor()}>{T.add}</Button>}
      </div>
      <div role="status" className={styles.notice}>{notice}</div>
      {failure && <p role="alert" className={styles.failure}>{failure}</p>}

      {loadState === 'error' && addresses.length === 0 ? (
        <div className={styles.empty} role="alert">
          <p>{T.loadError}</p>
          <div className={styles.actions}><Button small variant="secondary" onClick={retry}>{S.account.retry}</Button></div>
        </div>
      ) : showLoading ? (
        <p className={styles.note}>{T.loading}</p>
      ) : editor ? (
        <form key={editor.address?.id ?? 'new'} className={styles.editor} noValidate onSubmit={submit} aria-labelledby={`${id}-editor`}>
          <h3 id={`${id}-editor`} className={styles.subtitle}>{editor.address ? T.editTitle : T.newTitle}</h3>
          <p className={styles.note}>{server ? T.requiredNoteServer : T.requiredNoteLocal}</p>
          <div className={styles.grid}>
            {fields.map(({ name, label, autoComplete, type }) => name === 'address' ? (
              <TextareaField key={name} className={styles.fullWidth} name={name} label={label} autoComplete={autoComplete} required rows={3} maxLength={2000} defaultValue={editor.address?.[name] ?? ''} error={errors[name]} />
            ) : (
              <Field
                key={name}
                ref={name === 'label' ? firstField : undefined}
                name={name}
                label={name === optional ? `${label} (${S.common.optional})` : label}
                type={type ?? 'text'}
                autoComplete={autoComplete}
                required={name !== optional}
                maxLength={name === 'label' ? 60 : name === 'phone' ? 32 : name === 'postalCode' ? 20 : 100}
                defaultValue={editor.address?.[name] ?? (name === 'country' ? S.checkout.countryDefault : '')}
                error={errors[name]}
              />
            ))}
          </div>
          <Checkbox name="isDefault" label={T.useAsDefault} defaultChecked={editor.address?.isDefault ?? addresses.length === 0} />
          <div className={styles.actions}>
            <Button type="submit" disabled={busy}>{busy ? T.saving : T.save}</Button>
            <Button variant="ghost" onClick={() => finish('')}>{T.cancel}</Button>
          </div>
        </form>
      ) : addresses.length === 0 ? (
        <div className={styles.empty}>
          <h3 className={styles.subtitle}>{T.emptyTitle}</h3>
          <p>{T.emptyText}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {addresses.map((address) => {
            const label = addressDisplayLabel(address)
            return (
              <article key={address.id} className={styles.card} aria-label={label}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.subtitle}>{label}</h3>
                  {address.isDefault && <span className={styles.badge}>{T.defaultBadge}</span>}
                </div>
                <address className={styles.address}>
                  <span>{address.firstName} {address.lastName}</span>
                  <span className={styles.street}>{address.address}</span>
                  <span>{address.district} / {address.city}{address.postalCode ? ` · ${address.postalCode}` : ''}</span>
                  <span>{address.country}</span>
                  <span>{address.phone}</span>
                </address>
                <div className={styles.actions}>
                  <Button small variant="secondary" disabled={busy} onClick={() => openEditor(address)} aria-label={T.editAria(label)}>{T.edit}</Button>
                  <Button small variant="ghost" disabled={busy} onClick={() => { setDeletingId(address.id); setFailure(''); setNotice('') }} aria-expanded={deletingId === address.id} aria-label={T.removeAria(label)}>{T.remove}</Button>
                  {!address.isDefault && <Button small variant="ghost" disabled={busy} onClick={() => void run(() => setDefaultAddress(email, address.id), T.defaultUpdated)} aria-label={T.makeDefaultAria(label)}>{T.makeDefault}</Button>}
                </div>
                {deletingId === address.id && (
                  <div className={styles.confirmation} role="group" aria-label={T.removeConfirmGroup}>
                    <p>{T.removeConfirm(label)}</p>
                    <div className={styles.actions}>
                      <Button small disabled={busy} onClick={() => void run(() => removeAddress(email, address.id), T.removed)}>{T.removeYes}</Button>
                      <Button small variant="secondary" onClick={() => { setDeletingId(null); setFailure(''); heading.current?.focus() }}>{T.cancel}</Button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
