/** Checkout formu — saf doğrulama yardımcıları. Arayüzden bağımsız. */

import { EMAIL_RE } from '../../services/auth'
import { S } from '../../i18n'

export interface CheckoutFormValues {
  email: string
  phone: string
  firstName: string
  lastName: string
  address: string
  district: string
  city: string
  postalCode: string
  country: string
  note: string
  paymentMethod: '' | 'demo'
  agree: boolean
}

export type CheckoutErrors = Partial<Record<keyof CheckoutFormValues, string>>

export function initialCheckoutValues(accountEmail: string | null): CheckoutFormValues {
  return {
    email: accountEmail ?? '',
    phone: '',
    firstName: '',
    lastName: '',
    address: '',
    district: '',
    city: '',
    postalCode: '',
    country: S.checkout.countryDefault,
    note: '',
    paymentMethod: '',
    agree: false,
  }
}

/** Odak sırası — ilk hatalı alana gitmek için. */
export const CHECKOUT_FIELD_ORDER: (keyof CheckoutFormValues)[] = [
  'email',
  'phone',
  'firstName',
  'lastName',
  'address',
  'district',
  'city',
  'country',
  'paymentMethod',
  'agree',
]

function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 10
}

export function validateCheckout(values: CheckoutFormValues): CheckoutErrors {
  const errors: CheckoutErrors = {}

  if (!values.email.trim()) errors.email = S.checkout.requiredField
  else if (!EMAIL_RE.test(values.email.trim())) errors.email = S.checkout.invalidEmail

  if (!values.phone.trim()) errors.phone = S.checkout.requiredField
  else if (!isValidPhone(values.phone)) errors.phone = S.checkout.invalidPhone

  if (!values.firstName.trim()) errors.firstName = S.checkout.requiredField
  if (!values.lastName.trim()) errors.lastName = S.checkout.requiredField
  if (!values.address.trim()) errors.address = S.checkout.requiredField
  if (!values.district.trim()) errors.district = S.checkout.requiredField
  if (!values.city.trim()) errors.city = S.checkout.requiredField
  if (!values.country.trim()) errors.country = S.checkout.requiredField

  if (!values.paymentMethod) errors.paymentMethod = S.checkout.requiredField
  if (!values.agree) errors.agree = S.checkout.agreementRequired

  return errors
}

/** İlk hatalı alanı DOM'da bulup odaklar — her alan `checkout-${field}` id'siyle işaretlenir. */
export function focusFirstCheckoutError(errors: CheckoutErrors): void {
  const key = CHECKOUT_FIELD_ORDER.find((k) => errors[k])
  if (!key) return
  const el = document.getElementById(`checkout-${key}`)
  el?.focus()
}
