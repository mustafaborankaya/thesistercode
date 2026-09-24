import { Link } from 'react-router-dom'
import type { CheckoutErrors, CheckoutFormValues } from './validation'
import { S } from '../../i18n'
import { Checkbox, Field, TextareaField } from '../ui/Field'
import { Icon } from '../ui/Icon'
import { AccountChoice } from './AccountChoice'
import styles from './Checkout.module.css'
import { SavedAddressPicker } from './SavedAddressPicker'
import { useAccount } from '../../state/AccountContext'

interface CheckoutFormProps {
  values: CheckoutFormValues
  errors: CheckoutErrors
  onChange: <K extends keyof CheckoutFormValues>(field: K, value: CheckoutFormValues[K]) => void
}

/** Checkout'un üç adımı: İletişim → Teslimat → Ödeme, tek bir <form> içinde numaralı bölümler. */
export function CheckoutForm({ values, errors, onChange }: CheckoutFormProps) {
  const { account } = useAccount()
  return (
    <>
      <section className={styles.step}>
        <h2 className={styles.stepTitle}>
          <span className={styles.stepNum} aria-hidden="true">
            1
          </span>
          {S.checkout.steps.contact}
        </h2>
        <AccountChoice email={values.email} emailError={errors.email} onEmailChange={(v) => onChange('email', v)} />
        <Field
          id="checkout-phone"
          label={S.checkout.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.phone}
          error={errors.phone}
          onChange={(e) => onChange('phone', e.target.value)}
        />
      </section>

      <section className={styles.step}>
        <h2 className={styles.stepTitle}>
          <span className={styles.stepNum} aria-hidden="true">
            2
          </span>
          {S.checkout.steps.delivery}
        </h2>
        {account && <SavedAddressPicker key={account.email} email={account.email} onSelect={(address) => {
          for (const field of ['firstName', 'lastName', 'phone', 'address', 'district', 'city', 'postalCode', 'country'] as const) onChange(field, address[field])
        }} />}
        <div className={styles.grid2}>
          <Field
            id="checkout-firstName"
            label={S.checkout.firstName}
            autoComplete="given-name"
            value={values.firstName}
            error={errors.firstName}
            onChange={(e) => onChange('firstName', e.target.value)}
          />
          <Field
            id="checkout-lastName"
            label={S.checkout.lastName}
            autoComplete="family-name"
            value={values.lastName}
            error={errors.lastName}
            onChange={(e) => onChange('lastName', e.target.value)}
          />
        </div>
        <TextareaField
          id="checkout-address"
          label={S.checkout.address}
          rows={3}
          autoComplete="street-address"
          value={values.address}
          error={errors.address}
          onChange={(e) => onChange('address', e.target.value)}
        />
        <div className={styles.grid2}>
          <Field
            id="checkout-district"
            label={S.checkout.district}
            autoComplete="address-level2"
            value={values.district}
            error={errors.district}
            onChange={(e) => onChange('district', e.target.value)}
          />
          <Field
            id="checkout-city"
            label={S.checkout.city}
            autoComplete="address-level1"
            value={values.city}
            error={errors.city}
            onChange={(e) => onChange('city', e.target.value)}
          />
        </div>
        <div className={styles.grid2}>
          <Field
            id="checkout-postalCode"
            label={
              <>
                {S.checkout.postalCode}
              </>
            }
            autoComplete="postal-code"
            value={values.postalCode}
            onChange={(e) => onChange('postalCode', e.target.value)}
          />
          <Field
            id="checkout-country"
            label={S.checkout.country}
            autoComplete="country-name"
            value={values.country}
            error={errors.country}
            onChange={(e) => onChange('country', e.target.value)}
          />
        </div>
        <TextareaField
          id="checkout-note"
          label={
            <>
              {S.checkout.deliveryNote} <span className="text-faint text-xs">({S.common.optional})</span>
            </>
          }
          rows={2}
          value={values.note}
          onChange={(e) => onChange('note', e.target.value)}
        />
      </section>

      <section className={styles.step}>
        <h2 className={styles.stepTitle}>
          <span className={styles.stepNum} aria-hidden="true">
            3
          </span>
          {S.checkout.steps.payment}
        </h2>
        <div className={styles.radioGroup} role="radiogroup" aria-label={S.checkout.paymentMethod}>
          <label className={styles.radioOption}>
            <input
              id="checkout-paymentMethod"
              type="radio"
              name="checkout-payment-method"
              checked={values.paymentMethod === 'demo'}
              onChange={() => onChange('paymentMethod', 'demo')}
            />
            {S.checkout.paymentDemo}
          </label>
        </div>
        <p className={styles.paymentPending}>{S.checkout.paymentPending}</p>
        {errors.paymentMethod ? (
          <div role="alert" className={styles.formError}>
            <Icon name="info" size={14} />
            <span>{errors.paymentMethod}</span>
          </div>
        ) : null}
        <Checkbox
          id="checkout-agree"
          label={
            <Link to="/bilgi/alisveris-kosullari" className="link">
              {S.checkout.agreementLabel}
            </Link>
          }
          checked={values.agree}
          error={errors.agree}
          onChange={(e) => onChange('agree', e.target.checked)}
        />
      </section>
    </>
  )
}
