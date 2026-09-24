import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AccordionItem } from '../components/ui/Accordion'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { siteSettings } from '../config/settings'
import { isApiMode } from '../data/remote'
import { S } from '../i18n'
import { useAccount } from '../state/AccountContext'
import authStyles from './Auth.module.css'
import pageStyles from './Page.module.css'
import { AddressBook } from '../components/account/AddressBook'
import { CustomerNotifications, CustomerOrders } from '../components/account/CustomerOrders'

export function AccountPage() {
  const { isLoggedIn, account, discountEligible, logout } = useAccount()
  const location = useLocation()
  const navigate = useNavigate()

  if (!isLoggedIn || !account) {
    return <Navigate to="/giris" replace state={{ from: '/hesap' }} />
  }

  const registered = (location.state as { registered?: boolean } | null)?.registered
  const apiMode = isApiMode()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className={[pageStyles.page, pageStyles.narrow].join(' ')}>
      <h1 className={pageStyles.title}>{S.account.welcome(account.name)}</h1>
      {registered ? (
        <p role="status" className={authStyles.successNote}>
          <Icon name="check" size={16} />
          <span>{S.account.registerSuccess}</span>
        </p>
      ) : null}

      {/* API modunda siparişler (GET /account/orders) ve adresler (/account/addresses) sunucudan gelir;
          yerel demo notu ve yalnızca-demo bildirim/talep akışı yalnızca API kapalıyken gösterilir. */}
      {apiMode ? null : <p className={authStyles.demoNote}>Siparişleriniz, adresleriniz ve talepleriniz bu tarayıcıda saklanır. Bildirimlerinizi hesabınızdan takip edebilirsiniz.</p>}
      <div key={account.email} className={authStyles.accordionGroup}>
        <AccordionItem title={S.account.discountStatus} defaultOpen>
          <p>{discountEligible ? S.account.discountActive(siteSettings.memberDiscount.percent) : S.account.discountInactive}</p>
        </AccordionItem>
        <AccordionItem title={S.account.orders}>
          <CustomerOrders email={account.email} />
        </AccordionItem>
        <AccordionItem title={S.account.addresses}>
          <AddressBook email={account.email} />
        </AccordionItem>
        {apiMode ? null : (
          <AccordionItem title={S.account.notifications}>
            <CustomerNotifications email={account.email} />
          </AccordionItem>
        )}
        <AccordionItem title={S.account.favoritesLink}>
          <Link to="/favoriler" className="link">
            {S.account.favoritesLink}
          </Link>
        </AccordionItem>
      </div>

      <div className={authStyles.logoutRow}>
        <Button variant="secondary" onClick={handleLogout}>
          {S.account.logout}
        </Button>
      </div>
    </div>
  )
}
