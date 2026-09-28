/** Tabs bileşeniyle eşleşen sekme paneli nitelikleri. */
export function tabPanelProps(idPrefix: string, id: string, active: string) {
  return {
    role: 'tabpanel' as const,
    id: `${idPrefix}-panel-${id}`,
    'aria-labelledby': `${idPrefix}-tab-${id}`,
    hidden: id !== active,
    tabIndex: 0,
  }
}
