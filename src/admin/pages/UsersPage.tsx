import { useState } from 'react'
import { apiErrorMessage } from '../../i18n/apiMessages'
import { createAdminUser, listAdminUsers, updateAdminUser, type AdminUserRow } from '../adminApi'
import { currentAdmin } from '../adminAuth'
import { AS } from '../adminStrings'
import { Btn } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DataTable, type Column } from '../ui/DataTable'
import { SelectField, TextField } from '../ui/Form'
import { EmptyState, ErrorState, Notice, PageHeader } from '../ui/Page'
import { StatusBadge } from '../ui/StatusBadge'
import { formatDate, formatWhen } from '../ui/format'
import { useToast } from '../ui/toastContext'
import { useLoader } from '../ui/useLoader'
import ui from '../ui/ui.module.css'

interface CreateForm {
  username: string
  password: string
  role: 'owner' | 'editor'
}

const emptyCreateForm: CreateForm = { username: '', password: '', role: 'editor' }

/**
 * `/admin/kullanicilar` — yalnızca API modunda ve sahip rolünde menüde görünür (GET/POST/PATCH /admin/users).
 * Oluşturma/değiştirme owner içindir; editor 403 alır.
 */
export function UsersPage() {
  const toast = useToast()
  const list = useLoader(listAdminUsers)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm)
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateForm, string>>>({})
  const [createPending, setCreatePending] = useState(false)
  const [pwUser, setPwUser] = useState<AdminUserRow | null>(null)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [deactivateUser, setDeactivateUser] = useState<AdminUserRow | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const isOwner = currentAdmin?.role === 'owner'

  async function handleCreate() {
    const errs: Partial<Record<keyof CreateForm, string>> = {}
    if (createForm.username.trim().length < 3) errs.username = AS.users.usernameInvalid
    if (createForm.password.length < 8) errs.password = AS.users.passwordInvalid
    setCreateErrors(errs)
    if (Object.keys(errs).length) return
    setCreatePending(true)
    try {
      await createAdminUser({ ...createForm, username: createForm.username.trim() })
      toast.success(AS.users.createdToast(createForm.username.trim()))
      setCreateForm(emptyCreateForm)
      setCreating(false)
      list.reload()
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setCreatePending(false)
    }
  }

  async function setActive(user: AdminUserRow, active: boolean) {
    setBusyId(user.id)
    try {
      await updateAdminUser(user.id, { is_active: active })
      toast.success(active ? AS.users.activated(user.username) : AS.users.deactivated(user.username))
      list.reload()
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setBusyId(null)
      setDeactivateUser(null)
    }
  }

  async function changePassword() {
    if (!pwUser) return
    if (pw.length < 8) {
      setPwError(AS.users.passwordInvalid)
      return
    }
    setBusyId(pwUser.id)
    try {
      await updateAdminUser(pwUser.id, { password: pw })
      toast.success(AS.users.passwordChanged)
      setPwUser(null)
      setPw('')
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'username',
      header: AS.users.username,
      primary: true,
      sortValue: (u) => u.username,
      render: (u) => (
        <span className={ui.cellTitle}>
          {u.username}
          {u.id === currentAdmin?.id ? <span className={ui.muted}> ({AS.users.you})</span> : null}
        </span>
      ),
    },
    { key: 'role', header: AS.users.role, sortValue: (u) => u.role, render: (u) => (u.role === 'owner' ? AS.users.roleOwner : AS.users.roleEditor) },
    {
      key: 'status',
      header: AS.users.status,
      sortValue: (u) => u.is_active,
      render: (u) => <StatusBadge tone={u.is_active === 1 ? 'success' : 'neutral'}>{u.is_active === 1 ? AS.users.active : AS.users.inactive}</StatusBadge>,
    },
    { key: 'last', header: AS.users.lastLogin, sortValue: (u) => u.last_login_at ?? '', render: (u) => (u.last_login_at ? formatWhen(u.last_login_at) : AS.users.never) },
    { key: 'created', header: AS.users.created, sortValue: (u) => u.created_at, render: (u) => formatDate(u.created_at) },
  ]

  return (
    <div>
      <PageHeader
        title={AS.users.title}
        description={AS.users.subtitle}
        actions={
          isOwner ? (
            <Btn variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {AS.users.add}
            </Btn>
          ) : null
        }
      />
      {!isOwner ? <Notice tone="neutral">{AS.users.ownerOnlyNote}</Notice> : null}
      <p className={ui.hint} style={{ marginBottom: 12 }}>
        {AS.users.roleHelp}
      </p>
      {list.error && !list.data ? (
        <ErrorState message={apiErrorMessage(list.error)} onRetry={list.reload} />
      ) : (
        <DataTable
          caption={AS.users.title}
          columns={columns}
          rows={list.data ?? null}
          rowKey={(u) => String(u.id)}
          rowActions={
            isOwner
              ? (u) => (
                  <>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPwUser(u)
                        setPw('')
                        setPwError(null)
                      }}
                    >
                      {AS.users.changePassword}
                    </Btn>
                    {u.is_active === 1 ? (
                      <Btn size="sm" variant="ghost" disabled={u.id === currentAdmin?.id} loading={busyId === u.id} onClick={() => setDeactivateUser(u)}>
                        {AS.users.deactivate}
                      </Btn>
                    ) : (
                      <Btn size="sm" variant="ghost" loading={busyId === u.id} onClick={() => void setActive(u, true)}>
                        {AS.users.activate}
                      </Btn>
                    )}
                  </>
                )
              : undefined
          }
          empty={<EmptyState icon="users" title={AS.users.empty} />}
        />
      )}

      <ConfirmDialog
        open={creating}
        title={AS.users.createTitle}
        confirmLabel={AS.users.createButton}
        pending={createPending}
        onCancel={() => {
          setCreating(false)
          setCreateErrors({})
        }}
        onConfirm={() => void handleCreate()}
      >
        <form
          className={ui.stack}
          style={{ marginTop: 12 }}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void handleCreate()
          }}
        >
          <TextField
            label={AS.users.usernameLabel}
            hint={AS.users.usernameHint}
            autoComplete="off"
            value={createForm.username}
            error={createErrors.username}
            onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
          />
          <TextField
            label={AS.users.passwordLabel}
            hint={AS.users.passwordHint}
            type="password"
            autoComplete="new-password"
            value={createForm.password}
            error={createErrors.password}
            onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
          />
          <SelectField label={AS.users.roleLabel} value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as 'owner' | 'editor' }))}>
            <option value="editor">{AS.users.roleEditor}</option>
            <option value="owner">{AS.users.roleOwner}</option>
          </SelectField>
          <button type="submit" hidden />
        </form>
      </ConfirmDialog>

      <ConfirmDialog
        open={pwUser != null}
        title={pwUser ? AS.users.changePasswordTitle(pwUser.username) : ''}
        confirmLabel={AS.users.changePasswordButton}
        pending={pwUser != null && busyId === pwUser.id}
        onCancel={() => setPwUser(null)}
        onConfirm={() => void changePassword()}
      >
        <form
          style={{ marginTop: 12 }}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void changePassword()
          }}
        >
          <TextField
            label={AS.users.newPasswordLabel}
            hint={AS.users.passwordHint}
            type="password"
            autoComplete="new-password"
            value={pw}
            error={pwError}
            onChange={(e) => {
              setPw(e.target.value)
              setPwError(null)
            }}
          />
          <button type="submit" hidden />
        </form>
      </ConfirmDialog>

      <ConfirmDialog
        open={deactivateUser != null}
        title={deactivateUser ? AS.users.deactivateTitle(deactivateUser.username) : ''}
        message={AS.users.deactivateText}
        confirmLabel={AS.users.deactivate}
        tone="danger"
        pending={deactivateUser != null && busyId === deactivateUser.id}
        onCancel={() => setDeactivateUser(null)}
        onConfirm={() => deactivateUser && void setActive(deactivateUser, false)}
      />
    </div>
  )
}
