import { useEffect, useReducer, useState } from 'react'
import { listAddresses, subscribeCustomer, type SavedAddress } from '../../services/customer'
import { SelectField } from '../ui/Field'

export function SavedAddressPicker({ email, onSelect }: { email: string; onSelect: (address: SavedAddress) => void }) {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  const [selected, setSelected] = useState('')
  useEffect(() => subscribeCustomer(refresh), [])
  const addresses = listAddresses(email)
  if (!addresses.length) return null
  return <SelectField label="Kayıtlı adreslerim" value={addresses.some((item) => item.id === selected) ? selected : ''} onChange={(event) => {
    const id = event.target.value
    setSelected(id)
    const address = addresses.find((item) => item.id === id)
    if (address) onSelect(address)
  }} hint="Adres seçtikten sonra teslimat bilgilerini bu sipariş için düzenleyebilirsiniz.">
    <option value="">Adres seçin</option>
    {[...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)).map((address) => <option key={address.id} value={address.id}>{address.label}{address.isDefault ? ' (Varsayılan)' : ''} — {address.district} / {address.city}</option>)}
  </SelectField>
}
