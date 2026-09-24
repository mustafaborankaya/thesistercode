import { useNavigate } from 'react-router-dom'
import { S } from '../../i18n'
import { useCart } from '../../state/CartContext'
import { usePanels } from '../../state/PanelContext'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import styles from './Cart.module.css'
import { CartLineItem } from './CartLineItem'
import { CartSummary } from './CartSummary'

/** Sağdan kayan sepet paneli — ürün eklenince otomatik açılır; sepet sayfasıyla aynı veriyi kullanır. */
export function CartDrawer() {
  const { isOpen, closePanel } = usePanels()
  const { lines, totals } = useCart()
  const navigate = useNavigate()
  const open = isOpen('cart')
  const close = () => closePanel('cart')
  const go = (to: string) => {
    close()
    navigate(to)
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title={S.cart.title}
      side="right"
      closeLabel={S.cart.closeDrawer}
      headerExtra={<span className={styles.headerCount}>{S.cart.itemCount(totals.itemCount)}</span>}
      footer={
        lines.length > 0 ? (
          <>
            <CartSummary totals={totals} />
            <div className={styles.actions}>
              <Button variant="secondary" block onClick={() => go('/sepet')}>
                {S.cart.goToCart}
              </Button>
              <Button variant="primary" block onClick={() => go('/odeme')}>
                {S.cart.checkout}
              </Button>
            </div>
          </>
        ) : undefined
      }
    >
      <div id="cart-drawer">
        {lines.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{S.cart.empty}</p>
            <p className="text-soft text-sm">{S.cart.emptyHint}</p>
            <div>
              <Button variant="secondary" onClick={() => go('/koleksiyon')}>
                {S.common.continueShopping}
              </Button>
            </div>
          </div>
        ) : (
          <ul className={styles.lines}>
            {lines.map((line) => (
              <CartLineItem key={line.key} line={line} />
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  )
}
