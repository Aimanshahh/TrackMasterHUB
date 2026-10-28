import { useState } from 'react';

export default function CreateUserDrawer({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('salesperson');
  const [error, setError] = useState(null);

  if (!open) return null;

  function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Enter a name for the account.');
      return;
    }

    if (!email.trim()) {
      setError('Enter an email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    onCreated({ name: name.trim(), email: email.trim(), password, role });
    onClose();
  }

  return (
    <div className="drawer-root">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="drawer">
        <div className="drawer__head">
          <p className="drawer__eyebrow">New user</p>
          <h2 className="drawer__title">Create account</h2>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form className="drawer__form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <div className="field">
              <label className="field__label" htmlFor="create-user-name">Name</label>
              <input
                id="create-user-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex Rivera"
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="create-user-email">Email</label>
              <input
                id="create-user-email"
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="alex@example.com"
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="create-user-role">Role</label>
              <select
                id="create-user-role"
                className="input input--select"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="salesperson">Salesperson</option>
                <option value="manager">Manager</option>
                <option value="operations">Operations</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="field field--full">
              <label className="field__label" htmlFor="create-user-password">Password</label>
              <input
                id="create-user-password"
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          {error ? (
            <p className="form-alert" role="alert">{error}</p>
          ) : null}

          <div className="drawer__foot">
            <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary">Create account</button>
          </div>
        </form>
      </div>
    </div>
  );
}
