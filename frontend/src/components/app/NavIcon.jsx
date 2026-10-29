const icons = {
  overview: <><rect x="2" y="2" width="5" height="5" rx=".7"/><rect x="9" y="2" width="5" height="5" rx=".7"/><rect x="2" y="9" width="5" height="5" rx=".7"/><rect x="9" y="9" width="5" height="5" rx=".7"/></>,
  customers: <><circle cx="6" cy="5" r="2.2"/><path d="M1.8 13c.4-2.2 1.8-3.4 4.2-3.4s3.8 1.2 4.2 3.4"/><path d="M10 3.2a2.1 2.1 0 0 1 0 3.8M11.2 9.8c1.8.3 2.8 1.3 3 3.2"/></>,
  followup: <><rect x="3" y="2.5" width="10" height="12" rx="1.2"/><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3"/></>,
  sales: <><path d="M2 13h12M3.5 10.5 6.5 7.5l2.2 1.8L13 4.5"/><path d="M10 4.5h3v3"/></>,
  operations: <><path d="M3 3h10v10H3z"/><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3"/></>,
  complaints: <><path d="M8 2.2a5.6 5.6 0 0 0-3.5 10l-.8 1.7 2.5-.6A5.6 5.6 0 1 0 8 2.2Z"/><path d="M8 5.2v3M8 10.5h.01"/></>,
  reports: <><path d="M3 13.5V8.8M8 13.5V3M13 13.5V6"/></>,
  pricing: <><path d="M3 3h10v10H3z"/><path d="M5.2 6.3h5.6M5.2 9.7h3.2"/></>,
  users: <><circle cx="6" cy="5" r="2"/><circle cx="11.5" cy="6" r="1.5"/><path d="M1.8 13c.3-2.2 1.7-3.4 4.2-3.4s3.9 1.2 4.2 3.4M10 10c1.9-.2 3.3.8 3.8 2.5"/></>,
  activity: <><path d="M2 8h2.5l1.4-3.5L9 11l1.4-3H14"/></>,
  settings: <><circle cx="8" cy="8" r="2.5"/><path d="m8 1.8.8 1.5 1.8.4 1.5-.8 1.2 1.2-.8 1.5.4 1.8 1.5.8v1.7l-1.5.8-.4 1.8.8 1.5-1.2 1.2-1.5-.8-1.8.4-.8 1.5H6.3l-.8-1.5-1.8-.4-1.5.8L1 13.4l.8-1.5-.4-1.8L0 9.3V7.6l1.5-.8.4-1.8L1.1 3.5l1.2-1.2 1.5.8 1.8-.4.8-1.5Z" transform="translate(1 0) scale(.86)"/></>,
  menu: <><path d="M2 4h12M2 8h12M2 12h12"/></>,
  chevron: <><path d="m5 6 3 3 3-3"/></>,
};

export function NavIcon({ name, size = 16, className = '' }) {
  return <span className={`nav-icon ${className}`.trim()} aria-hidden="true"><svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">{icons[name] ?? null}</svg></span>;
}
