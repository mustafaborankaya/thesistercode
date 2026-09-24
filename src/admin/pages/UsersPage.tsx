import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, SelectField } from '../../components/ui/Field'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { createAdminUser, listAdminUsers, updateAdminUser, type AdminUserRow } from '../adminApi'
import { currentAdmin } from '../adminAuth'
import { AS } from '../adminStrings'
import styles from '../admin.module.css'

interface CreateForm {
  username: string
  password: string
  role: 'owner' | 'editor'
}

const emptyCreateForm: CreateForm = { username: '', password: '', role: 'editor' }

/** `/admin/kullanicilar` — yalnızca API modunda gösterilir (GET/POST/PATCH /admin/users). Oluşturma/değiştirme yalnızca owner rolü içindir; editor 403 alır ve kibarca bilgilendirilir. */
export function UsersPage() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createPending, setCreatePending] = useState(false)
  const [rowMessage, setRowMessage] = useState<Record<number, string>>({})
  const [rowError, setRowError] = useState<Record<number, string>>({})
  const [rowPending, setRowPending] = useState<Record<number, boolean>>({})
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>({})

  function refresh() {
    setListError(null)
    listAdminUsers()
      .then(setUsers)
      .catch((e) => setListError(apiErrorMessage(e)))
  }

  useEffect(refresh, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreatePending(true)
    try {
      await createAdminUser(createForm)
      setCreateForm(emptyCreateForm)
      refresh()
    } catch (err) {
      setCreateError(apiErrorMessage(err))
    } finally {
      setCreatePending(false)
    }
  }

  async function handleToggleActive(user: AdminUserRow) {
    setRowPending((s) => ({ ...s, [user.id]: true }))
    setRowError((s) => ({ ...s, [user.id]: '' }))
    try {
      await updateAdminUser(user.id, { is_active: user.is_active === 1 ? false : true })
      setRowMessage((s) => ({ ...s, [user.id]: AS.apiNotice.saved }))
      refresh()
    } catch (e) {
      setRowError((s) => ({ ...s, [user.id]: apiErrorMessage(e) }))
    } finally {
      setRowPending((s) => ({ ...s, [user.id]: false }))
    }
  }

  async function handleChangePassword(user: AdminUserRow) {
    const password = passwordDrafts[user.id] ?? ''
    if (password.length < 8) {
      setRowError((s) => ({ ...s, [user.id]: 'Parola en az 8 karakter olmalı.' }))
      return
    }
    setRowPending((s) => ({ ...s, [user.id]: true }))
    setRowError((s) => ({ ...s, [user.id]: '' }))
    try {
      await updateAdminUser(user.id, { password })
      setPasswordDrafts((s) => ({ ...s, [user.id]: '' }))
      setRowMessage((s) => ({ ...s, [user.id]: AS.users.passwordChanged }))
    } catch (e) {
      setRowError((s) => ({ ...s, [user.id]: apiErrorMessage(e) }))
    } finally {
      setRowPending((s) => ({ ...s, [user.id]: false }))
    }
  }

  const isOwner = currentAdmin?.role === 'owner'

  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{AS.users.title}</h1>
      </div>
      {!isOwner ? (
        <p className="text-soft text-sm" style={{ marginBottom: 'var(--sp-4)' }}>
          {AS.users.ownerOnlyNote}
        </p>
      ) : null}

      {listError ? (
        <p className={styles.empty} role="alert">
          {listError}
        </p>
      ) : !users ? (
        <p className={styles.empty}>{AS.common.loading}</p>
      ) : users.length === 0 ? (
        <p className={styles.empty}>{AS.users.empty}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{AS.users.username}</th>
                <th scope="col">{AS.users.role}</th>
                <th scope="col">{AS.users.active}</th>
                <th scope="col">{AS.users.lastLogin}</th>
                <th scope="col">{AS.users.newPasswordLabel}</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.role === 'owner' ? AS.users.roleOwner : AS.users.roleEditor}</td>
                  <td>{user.is_active === 1 ? AS.users.active : AS.users.inactive}</td>
                  <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString('tr-TR') : AS.users.never}</td>
                  <td>
                    <label className="sr-only" htmlFor={`user-pw-${user.id}`}>
                      {AS.users.newPasswordLabel} — {user.username}
                    </label>
                    <input
                      id={`user-pw-${user.id}`}
                      type="password"
                      autoComplete="new-password"
                      value={passwordDrafts[user.id] ?? ''}
                      onChange={(e) => setPasswordDrafts((s) => ({ ...s, [user.id]: e.target.value }))}
                    />
                  </td>
                  <td>
                    <div className={styles.pageActions}>
                      <Button small variant="secondary" disabled={rowPending[user.id]} onClick={() => void handleChangePassword(user)}>
                        {AS.users.changePasswordButton}
                      </Button>
                      <Button small variant="ghost" disabled={rowPending[user.id]} onClick={() => void handleToggleActive(user)}>
                        {user.is_active === 1 ? AS.users.deactivate : AS.users.activate}
                      </Button>
                    </div>
                    {rowMessage[user.id] ? <p className="text-sm">{rowMessage[user.id]}</p> : null}
                    {rowError[user.id] ? (
                      <p role="alert" className="text-sm">
                        {rowError[user.id]}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{AS.users.createTitle}</div>
        <form className={styles.grid} onSubmit={handleCreate}>
          <Field
            label={AS.users.usernameLabel}
            value={createForm.username}
            onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
            minLength={3}
            required
          />
          <Field
            label={AS.users.passwordLabel}
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
            minLength={8}
            autoComplete="new-password"
            required
          />
          <SelectField label={AS.users.roleLabel} value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as 'owner' | 'editor' }))}>
            <option value="editor">{AS.users.roleEditor}</option>
            <option value="owner">{AS.users.roleOwner}</option>
          </SelectField>
          <div>
            <Button type="submit" disabled={createPending}>
              {AS.users.createButton}
            </Button>
          </div>
        </form>
        {createError ? (
          <p role="alert" className="text-sm" style={{ marginTop: 'var(--sp-2)' }}>
            {createError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
