import type { ReactNode } from "react";

const symbols = {
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  edit: <><path d="m15 5 4 4M4 20l4-1L20 7a3 3 0 0 0-4-4L4 15z" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2" /></>,
  folder: <path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  archive: <><rect x="3" y="3" width="18" height="5" rx="1" /><path d="M5 8v12h14V8M10 12h4" /></>,
  restore: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6M12 8v5l3 2" /></>,
  settings: <><path d="M4 7h16M4 17h16M8 4v6M16 14v6" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></>,
  single: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 12h8" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  checked: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m7 12 3 3 7-7" /></>,
  ready: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  loader: <><path d="M21 12a9 9 0 1 1-9-9" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  upload: <><path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5" /></>,
  chevron: <path d="m8 10 4 4 4-4" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  note: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h5" /></>,
  brand: <><path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof symbols;
export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{symbols[name]}</svg>;
}
