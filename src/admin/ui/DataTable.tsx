import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AS } from '../adminStrings'
import { AdminIcon } from './AdminIcon'
import { Btn } from './Button'
import s from './ui.module.css'

export interface Column<T> {
  key: string
  header: string
  /** Başlığı görsel olarak gizle (ör. eylem sütunu). */
  hideHeader?: boolean
  render: (row: T) => ReactNode
  /** Verilirse sütun sıralanabilir. */
  sortValue?: (row: T) => string | number | null | undefined
  align?: 'left' | 'right' | 'center'
  /** Mobil kart görünümünde başlık satırı olarak gösterilir. */
  primary?: boolean
  width?: number | string
}

export type SortState = { key: string; dir: 'asc' | 'desc' }

interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  /** null → yükleniyor (iskelet satırlar). */
  rows: T[] | null
  rowKey: (row: T) => string
  empty?: ReactNode
  onRowClick?: (row: T) => void
  /** Klavye ile satır açılırken okunacak ad. */
  rowLabel?: (row: T) => string
  pageSize?: number
  initialSort?: SortState
  selection?: { selected: Set<string>; onChange: (next: Set<string>) => void; label: (row: T) => string }
  bulkActions?: ReactNode
  rowActions?: (row: T) => ReactNode
  /** Sunucu sayfalaması: satırlar zaten o sayfanındır. */
  server?: { page: number; total: number; onPage: (page: number) => void }
  /** Değiştiğinde (ör. filtre) 1. sayfaya dönülür. */
  resetKey?: string
  isRowSelected?: (row: T) => boolean
}

const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"]'

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'tr', { numeric: true, sensitivity: 'base' })
}

/**
 * Panel tablosu: yapışkan başlık, sütun sıralama, 20/sayfa sayfalama, satır seçimi + toplu eylem,
 * satır eylemleri, boş durum, iskelet yükleme. 720px altında her satır bir karta dönüşür.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  rowLabel,
  pageSize = 20,
  initialSort,
  selection,
  bulkActions,
  rowActions,
  server,
  resetKey = '',
  isRowSelected,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null)
  const [page, setPage] = useState(1)
  const [prevReset, setPrevReset] = useState(resetKey)
  if (prevReset !== resetKey) {
    setPrevReset(resetKey)
    setPage(1)
  }

  const sorted = useMemo(() => {
    if (!rows) return null
    if (!sort || server) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const get = col.sortValue
    const out = [...rows].sort((a, b) => compare(get(a), get(b)))
    return sort.dir === 'desc' ? out.reverse() : out
  }, [rows, sort, columns, server])

  const total = server ? server.total : (sorted?.length ?? 0)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = server ? server.page : Math.min(page, pageCount)
  const visible = sorted ? (server ? sorted : sorted.slice((current - 1) * pageSize, current * pageSize)) : null

  function goto(p: number) {
    if (server) server.onPage(p)
    else setPage(p)
  }

  function toggleSort(key: string) {
    setSort((cur) => (!cur || cur.key !== key ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : null))
  }

  // Seçim: başlıktaki kutu yalnızca görünen sayfadaki satırları seçer.
  const headRef = useRef<HTMLInputElement>(null)
  const visibleKeys = visible ? visible.map(rowKey) : []
  const selectedOnPage = selection ? visibleKeys.filter((k) => selection.selected.has(k)).length : 0
  const allOnPage = visibleKeys.length > 0 && selectedOnPage === visibleKeys.length
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = selectedOnPage > 0 && !allOnPage
  }, [selectedOnPage, allOnPage])

  function toggleAll() {
    if (!selection) return
    const next = new Set(selection.selected)
    if (allOnPage) visibleKeys.forEach((k) => next.delete(k))
    else visibleKeys.forEach((k) => next.add(k))
    selection.onChange(next)
  }

  function toggleOne(key: string) {
    if (!selection) return
    const next = new Set(selection.selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selection.onChange(next)
  }

  const colCount = columns.length + (selection ? 1 : 0) + (rowActions ? 1 : 0)
  const alignClass = (a?: 'left' | 'right' | 'center') => (a === 'right' ? s.alignRight : a === 'center' ? s.alignCenter : undefined)

  return (
    <div className={s.tableCard}>
      {selection && selection.selected.size > 0 ? (
        <div className={s.bulkBar} role="region" aria-label={AS.table.bulkRegion}>
          <strong>{AS.table.selected(selection.selected.size)}</strong>
          {bulkActions}
          <Btn size="sm" variant="ghost" onClick={() => selection.onChange(new Set())}>
            {AS.table.clearSelection}
          </Btn>
        </div>
      ) : null}
      <div className={s.tableScroll}>
        <table className={s.table}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selection ? (
                <th scope="col" className={s.checkCell}>
                  <input ref={headRef} type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label={AS.table.selectPage} disabled={!visibleKeys.length} />
                </th>
              ) : null}
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={alignClass(c.align)}
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {c.hideHeader ? (
                      <span className="sr-only">{c.header}</span>
                    ) : c.sortValue && !server ? (
                      <button type="button" className={s.sortBtn} onClick={() => toggleSort(c.key)}>
                        {c.header}
                        <AdminIcon name={active ? (sort!.dir === 'asc' ? 'sort-asc' : 'sort-desc') : 'sort'} size={14} />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
              {rowActions ? (
                <th scope="col" className={s.actionsCell}>
                  <span className="sr-only">{AS.table.actions}</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {!visible
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk-${i}`} aria-hidden="true">
                    {Array.from({ length: colCount }, (_, j) => (
                      <td key={j} data-label="">
                        <span className={s.skeleton} style={{ width: j === 0 ? '70%' : `${40 + ((i * 7 + j * 13) % 45)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.length === 0
                ? (
                    <tr>
                      <td colSpan={colCount} data-label="" style={{ padding: 0 }}>
                        {empty ?? <div className={s.empty}>{AS.table.empty}</div>}
                      </td>
                    </tr>
                  )
                : visible.map((row) => {
                    const key = rowKey(row)
                    const selected = selection?.selected.has(key) || isRowSelected?.(row)
                    return (
                      <tr
                        key={key}
                        className={[onRowClick ? s.rowClickable : '', selected ? s.rowSelected : ''].join(' ').trim() || undefined}
                        tabIndex={onRowClick ? 0 : undefined}
                        aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                        onClick={
                          onRowClick
                            ? (e) => {
                                if ((e.target as HTMLElement).closest(INTERACTIVE)) return
                                onRowClick(row)
                              }
                            : undefined
                        }
                        onKeyDown={
                          onRowClick
                            ? (e) => {
                                if (e.target !== e.currentTarget) return
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  onRowClick(row)
                                }
                              }
                            : undefined
                        }
                      >
                        {selection ? (
                          <td className={s.checkCell} data-label="">
                            <input type="checkbox" checked={selection.selected.has(key)} onChange={() => toggleOne(key)} aria-label={AS.table.selectRow(selection.label(row))} />
                          </td>
                        ) : null}
                        {columns.map((c) => (
                          <td key={c.key} className={alignClass(c.align)} data-label={c.hideHeader ? '' : c.header} data-primary={c.primary ? 'true' : undefined}>
                            {c.render(row)}
                          </td>
                        ))}
                        {rowActions ? (
                          <td className={s.actionsCell} data-label="">
                            <div className={s.row} style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                              {rowActions(row)}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
          </tbody>
        </table>
      </div>
      {visible && total > pageSize ? (
        <div className={s.tableFooter}>
          <span>{AS.table.range((current - 1) * pageSize + 1, Math.min(current * pageSize, total), total)}</span>
          <nav className={s.pager} aria-label={AS.table.pagination}>
            <Btn size="sm" variant="ghost" icon="chevron-left" iconOnly label={AS.table.prev} disabled={current <= 1} onClick={() => goto(current - 1)} />
            <span aria-current="page" style={{ padding: '0 8px' }}>
              {AS.table.pageOf(current, pageCount)}
            </span>
            <Btn size="sm" variant="ghost" icon="chevron-right" iconOnly label={AS.table.next} disabled={current >= pageCount} onClick={() => goto(current + 1)} />
          </nav>
        </div>
      ) : visible && total > 0 ? (
        <div className={s.tableFooter}>
          <span>{AS.table.count(total)}</span>
        </div>
      ) : null}
    </div>
  )
}
