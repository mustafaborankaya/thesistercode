export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'outline'

/** API sipariş durumu → rozet tonu. */
export function orderStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'paid':
    case 'shipped':
      return 'success'
    case 'new':
    case 'pending_payment':
      return 'warning'
    case 'cancelled':
      return 'danger'
    default:
      return 'neutral'
  }
}

/** Ödeme durumu → rozet tonu. */
export function paymentStatusTone(status: string | undefined | null): BadgeTone {
  switch (status) {
    case 'success':
      return 'success'
    case 'initialized':
      return 'warning'
    case 'failure':
      return 'danger'
    default:
      return 'neutral'
  }
}
