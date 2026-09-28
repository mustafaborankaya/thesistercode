/**
 * Panel ikonları — ince çizgili (1.5), 20px ızgara, `currentColor`. Mağazanın ortak Icon bileşeninden
 * bağımsızdır (src/components/ui/Icon.tsx'e dokunulmaz).
 */
const paths = {
  dashboard: 'M3 3.5h6v6H3zM11 3.5h6v4h-6zM11 9.5h6v7h-6zM3 11.5h6v5H3z',
  orders: 'M5 2.5h10v15l-2-1.3-1.5 1.3L10 16.2l-1.5 1.3L7 16.2l-2 1.3zM7.5 6.5h5M7.5 9.5h5M7.5 12.5h3',
  products: 'M7 3 3 5.5l1.6 3.3L6 8.2V17h8V8.2l1.4.6L17 5.5 13 3c-.5 1.3-1.6 2-3 2s-2.5-.7-3-2Z',
  coupons: 'M2.5 6.5V5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v1.5a2 2 0 0 0 0 4V15a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-4.5a2 2 0 0 0 0-4ZM12.5 4v12',
  customers: 'M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5M13 3.3a3 3 0 0 1 0 5.4M15 12.3c1.8.6 3 2.3 3 4.7',
  content: 'M5 2.5h7l3 3v12H5zM12 2.5v3h3M7.5 9h5M7.5 11.5h5M7.5 14h3',
  images: 'M3 4h14v12H3zM3 13l4-4 3 3 2-2 5 5M12.5 7.5h.01',
  settings:
    'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM16.2 11.8l1.3 1-1.5 2.6-1.6-.6a6 6 0 0 1-1.6.9l-.3 1.8h-3l-.3-1.8a6 6 0 0 1-1.6-.9l-1.6.6-1.5-2.6 1.3-1a6 6 0 0 1 0-1.8l-1.3-1 1.5-2.6 1.6.6a6 6 0 0 1 1.6-.9l.3-1.8h3l.3 1.8a6 6 0 0 1 1.6.9l1.6-.6 1.5 2.6-1.3 1a6 6 0 0 1 0 1.8Z',
  users: 'M10 2.5 3.5 5v4.5c0 4 2.8 6.9 6.5 8 3.7-1.1 6.5-4 6.5-8V5zM7.5 10l1.8 1.8 3.4-3.6',
  data: 'M10 7c3.6 0 6.5-1 6.5-2.3S13.6 2.5 10 2.5 3.5 3.4 3.5 4.7 6.4 7 10 7ZM3.5 4.7v10.6C3.5 16.6 6.4 17.5 10 17.5s6.5-.9 6.5-2.2V4.7M3.5 10c0 1.3 2.9 2.3 6.5 2.3s6.5-1 6.5-2.3',
  menu: 'M3 5.5h14M3 10h14M3 14.5h14',
  close: 'M5 5l10 10M15 5 5 15',
  search: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM13.5 13.5 17 17',
  plus: 'M10 4v12M4 10h12',
  minus: 'M4 10h12',
  external: 'M11 3.5h5.5V9M16.5 3.5 9 11M14 12v4.5H3.5V6H8',
  logout: 'M8 3.5H4v13h4M13 6.5l3.5 3.5-3.5 3.5M16.5 10H8',
  check: 'M4 10.5 8 14.5 16 5.5',
  alert: 'M10 3 18 17H2zM10 8.5v4M10 14.8v.01',
  info: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM10 9v5M10 6.3v.01',
  trash: 'M3.5 5.5h13M8 5.5V3.5h4v2M5 5.5l.8 11h8.4l.8-11M8.5 8.5v5M11.5 8.5v5',
  edit: 'M12.5 4.5l3 3L7 16H4v-3zM11 6l3 3',
  upload: 'M10 13V3.5M6.5 7 10 3.5 13.5 7M3.5 13v3.5h13V13',
  printer: 'M5.5 7.5V3h9v4.5M5.5 14H3.5V8h13v6h-2M5.5 11.5h9v5.5h-9z',
  eye: 'M1.8 10S4.7 4.5 10 4.5 18.2 10 18.2 10 15.3 15.5 10 15.5 1.8 10 1.8 10ZM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  'eye-off': 'M3 3l14 14M8.2 5a8.5 8.5 0 0 1 1.8-.5c5.3 0 8.2 5.5 8.2 5.5a14 14 0 0 1-2 2.7M5.6 6.4A13.6 13.6 0 0 0 1.8 10s2.9 5.5 8.2 5.5c1.3 0 2.5-.3 3.5-.8M8.2 8.3a2.5 2.5 0 0 0 3.5 3.5',
  copy: 'M7 7h9.5v9.5H7zM13 7V3.5H3.5V13H7',
  'chevron-left': 'M12.5 4 6.5 10l6 6',
  'chevron-right': 'M7.5 4l6 6-6 6',
  'chevron-down': 'M4 7.5l6 6 6-6',
  'chevron-up': 'M4 12.5l6-6 6 6',
  sort: 'M6.5 8 10 4.5 13.5 8M6.5 12 10 15.5 13.5 12',
  'sort-asc': 'M6.5 11 10 7.5l3.5 3.5',
  'sort-desc': 'M6.5 9 10 12.5 13.5 9',
  truck: 'M2 5h10v9H2zM12 8h3.5l2.5 3v3h-6M5 16.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM14.5 16.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  refresh: 'M16 4v4h-4M4 16v-4h4M15.5 8A6 6 0 0 0 4.7 6.8M4.5 12a6 6 0 0 0 10.8 1.2',
  user: 'M10 9.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 17.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5',
  store: 'M3 8v9h14V8M2.5 3.5h15l1 4.5h-17zM8 17v-5h4v5',
  box: 'M10 2.5 17 6v8l-7 3.5L3 14V6zM3 6l7 3.5L17 6M10 9.5v8',
  wallet: 'M3 5.5h13.5v11H3zM3 5.5 13 3v2.5M13 11h3.5',
  clock: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM10 6v4.5l3 2',
  note: 'M4 3.5h12v9l-4 4H4zM12 16.5v-4h4',
  card: 'M2.5 5h15v10h-15zM2.5 8h15M5.5 12h3',
  collapse: 'M8 3.5v13M3.5 3.5h13v13h-13zM13 8l-2 2 2 2',
  expand: 'M8 3.5v13M3.5 3.5h13v13h-13zM11 8l2 2-2 2',
  grip: 'M7.5 5h.01M12.5 5h.01M7.5 10h.01M12.5 10h.01M7.5 15h.01M12.5 15h.01',
} as const

export type AdminIconName = keyof typeof paths

interface AdminIconProps {
  name: AdminIconName
  size?: number
  className?: string
  /** Verilirse ikon erişilebilir bir ad taşır; verilmezse dekoratiftir (aria-hidden). */
  title?: string
}

export function AdminIcon({ name, size = 20, className, title }: AdminIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  )
}
