import { useEffect, useId, useReducer, useRef, useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Checkbox, Field, TextareaField } from '../ui/Field'
import { listAddresses, removeAddress, saveAddress, subscribeCustomer, type AddressInput, type SavedAddress } from '../../services/customer'
import styles from './AddressBook.module.css'

type TextKey = Exclude<keyof AddressInput, 'isDefault'>
const fields: { name: TextKey; label: string; autoComplete: string; type?: string }[] = [
  { name: 'label', label: 'Adres başlığı', autoComplete: 'off' },
  { name: 'firstName', label: 'Ad', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Soyad', autoComplete: 'family-name' },
  { name: 'phone', label: 'Telefon', autoComplete: 'tel', type: 'tel' },
  { name: 'address', label: 'Açık adres', autoComplete: 'street-address' },
  { name: 'district', label: 'İlçe', autoComplete: 'address-level2' },
  { name: 'city', label: 'İl', autoComplete: 'address-level1' },
  { name: 'postalCode', label: 'Posta kodu', autoComplete: 'postal-code' },
  { name: 'country', label: 'Ülke', autoComplete: 'country-name' },
]

export function AddressBook({ email }: { email: string }) {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  const [editor, setEditor] = useState<{ address?: SavedAddress } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<TextKey, string>>>({})
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState('')
  const firstField = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  const addresses = listAddresses(email)

  useEffect(() => subscribeCustomer(refresh), [])
  useEffect(() => { if (editor) firstField.current?.focus() }, [editor])

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
    setFailure(error instanceof Error ? error.message : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const input = Object.fromEntries(fields.map(({ name }) => [name, String(data.get(name) ?? '').trim()])) as Omit<AddressInput, 'isDefault'>
    const nextErrors: Partial<Record<TextKey, string>> = {}
    for (const { name, label } of fields) {
      if (name !== 'postalCode' && !input[name]) nextErrors[name] = `${label} alanını doldurun.`
    }
    if (input.phone && input.phone.replace(/\D/g, '').length < 10) {
      nextErrors.phone = 'Telefon numarası en az 10 rakam içermelidir.'
    }
    setErrors(nextErrors)
    setFailure('')
    const invalid = fields.find(({ name }) => nextErrors[name])
    if (invalid) {
      const control = form.elements.namedItem(invalid.name)
      if (control instanceof HTMLElement) control.focus()
      return
    }
    try {
      if (editor?.address && !addresses.some((address) => address.id === editor.address?.id)) {
        throw new Error('Bu adres artık kayıtlı değil. Yeni bir adres ekleyebilirsiniz.')
      }
      saveAddress(email, { ...input, isDefault: data.get('isDefault') === 'on' }, editor?.address?.id)
      finish(editor?.address ? 'Adres güncellendi.' : 'Adres kaydedildi.')
    } catch (error) { report(error) }
  }

  function makeDefault(address: SavedAddress) {
    try {
      const { id: addressId, ...input } = address
      saveAddress(email, { ...input, isDefault: true }, addressId)
      finish('Varsayılan adres güncellendi.')
    } catch (error) { report(error) }
  }

  function remove(addressId: string) {
    try {
      removeAddress(email, addressId)
      finish('Adres silindi.')
    } catch (error) { report(error) }
  }

  return (
    <section className={styles.book} aria-labelledby={`${id}-title`}>
      <div className={styles.header}>
        <div>
          <h2 id={`${id}-title`} className={styles.title} ref={heading} tabIndex={-1}>Adreslerim</h2>
          <p className={styles.note}>Adresleriniz bu tarayıcıda saklanır.</p>
        </div>
        {!editor && <Button variant="secondary" onClick={() => openEditor()}>Yeni adres ekle</Button>}
      </div>
      <div role="status" className={styles.notice}>{notice}</div>
      {failure && <p role="alert" className={styles.failure}>{failure}</p>}

      {editor ? (
        <form key={editor.address?.id ?? 'new'} className={styles.editor} noValidate onSubmit={submit} aria-labelledby={`${id}-editor`}>
          <h3 id={`${id}-editor`} className={styles.subtitle}>{editor.address ? 'Adresi düzenle' : 'Yeni adres'}</h3>
          <p className={styles.note}>Posta kodu dışındaki adres alanları zorunludur.</p>
          <div className={styles.grid}>
            {fields.map(({ name, label, autoComplete, type }) => name === 'address' ? (
              <TextareaField key={name} className={styles.fullWidth} name={name} label={label} autoComplete={autoComplete} required rows={3} defaultValue={editor.address?.[name] ?? ''} error={errors[name]} />
            ) : (
              <Field key={name} ref={name === 'label' ? firstField : undefined} name={name} label={name === 'postalCode' ? `${label} (isteğe bağlı)` : label} type={type ?? 'text'} autoComplete={autoComplete} required={name !== 'postalCode'} defaultValue={editor.address?.[name] ?? (name === 'country' ? 'Türkiye' : '')} error={errors[name]} />
            ))}
          </div>
          <Checkbox name="isDefault" label="Varsayılan adresim olarak kullan" defaultChecked={editor.address?.isDefault ?? addresses.length === 0} />
          <div className={styles.actions}>
            <Button type="submit">Adresi kaydet</Button>
            <Button variant="ghost" onClick={() => finish('')}>Vazgeç</Button>
          </div>
        </form>
      ) : addresses.length === 0 ? (
        <div className={styles.empty}>
          <h3 className={styles.subtitle}>Henüz kayıtlı adresiniz yok</h3>
          <p>Alışverişlerinizde kullanmak için ilk adresinizi ekleyin.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {addresses.map((address) => (
            <article key={address.id} className={styles.card} aria-label={address.label}>
              <div className={styles.cardHeader}>
                <h3 className={styles.subtitle}>{address.label}</h3>
                {address.isDefault && <span className={styles.badge}>Varsayılan</span>}
              </div>
              <address className={styles.address}>
                <span>{address.firstName} {address.lastName}</span>
                <span className={styles.street}>{address.address}</span>
                <span>{address.district} / {address.city} · {address.postalCode}</span>
                <span>{address.country}</span>
                <span>{address.phone}</span>
              </address>
              <div className={styles.actions}>
                <Button small variant="secondary" onClick={() => openEditor(address)} aria-label={`${address.label} adresini düzenle`}>Düzenle</Button>
                <Button small variant="ghost" onClick={() => { setDeletingId(address.id); setFailure(''); setNotice('') }} aria-expanded={deletingId === address.id} aria-label={`${address.label} adresini sil`}>Sil</Button>
                {!address.isDefault && <Button small variant="ghost" onClick={() => makeDefault(address)} aria-label={`${address.label} adresini varsayılan yap`}>Varsayılan yap</Button>}
              </div>
              {deletingId === address.id && (
                <div className={styles.confirmation} role="group" aria-label="Adres silme onayı">
                  <p>“{address.label}” adresini silmek istediğinize emin misiniz?</p>
                  <div className={styles.actions}>
                    <Button small onClick={() => remove(address.id)}>Evet, adresi sil</Button>
                    <Button small variant="secondary" onClick={() => { setDeletingId(null); setFailure(''); heading.current?.focus() }}>Vazgeç</Button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
