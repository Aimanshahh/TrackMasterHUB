import { useState } from 'react';

/**
 * Password field with a show/hide control. The value stays in the parent's
 * state exactly as before; only the input type toggles between password/text.
 */
export default function PasswordInput({ className = 'input', ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input {...inputProps} className={className} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3l18 18" />
            <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6-0.4 0.8-1.2 1.9-2.3 3" />
            <path d="M6.6 6.7C4.3 8.2 2.9 10.4 2.5 12c1 1.8 4.5 6 9.5 6 1.4 0 2.7-0.3 3.8-0.8" />
            <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 12C3.5 10.2 7 6 12 6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
