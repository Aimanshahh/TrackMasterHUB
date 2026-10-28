import { NavIcon } from './NavIcon.jsx';

const icons = {
  overview: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 7h2M4 10h2M8 7h2M8 11h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10 5h2M10 9h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  customers: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10.5" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 9.5h9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 12.5h7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  followup: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 4h6M5 7h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 12h8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  sales: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="6" width="14" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 10h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  operations: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 5h6M5 8h4M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  complaints: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 2.5v3M8 9.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 12h6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  reports: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4h10M5 4v5a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  pricing: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4h8v2H4z M4 8h8v2H4z M4 12h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  users: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 13h10" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  activity: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="3" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5 5v3a2 2 0 0 0 2 2h3M5 11h3M11 5v3a2 2 0 0 0 2 2M11 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
      <path d="M4 9.5h8M5 13.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

export function NavIcon({ name, size = 15, className = '' }) {
  const Icon = () => icons[name] ?? null;

  return (
    <span className={`nav-icon ${className}`.trim()}>
      <Icon />
    </span>
  );
}
