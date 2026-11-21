import { useState } from 'react';

/** A secret value that stays hidden until the viewer asks to see it. */
export default function PasswordReveal({ value, label = 'password' }) {
  const [shown, setShown] = useState(false);
  if (!value) return <span>—</span>;
  return (
    <span className="secret">
      <span className="secret__value mono">{shown ? value : '••••••••'}</span>
      <button
        type="button"
        className="secret__toggle"
        onClick={() => setShown((current) => !current)}
        aria-label={shown ? `Hide ${label}` : `Show ${label}`}
        aria-pressed={shown}
        title={shown ? 'Hide' : 'Show'}
      >
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" />
          <circle cx="10" cy="10" r="2.5" />
          {shown ? <path d="M3 17 17 3" /> : null}
        </svg>
      </button>
    </span>
  );
}
