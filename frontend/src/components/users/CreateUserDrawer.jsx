import { useState } from 'react';

export default function CreateUserDrawer({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('salesperson');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('Enter a name for the account.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');

    setSaving(true);
    try {
      await onCreated({ name: name.trim(), email: email.trim(), password, role });
      setName(''); setEmail(''); setPassword(''); setRole('salesperson');
      onClose();
    } catch (error_) {
      setError(error_.message ?? 'The account could not be created.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-root" role="presentation">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close account form" />
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
        <header className="drawer__head">
          <div><p className="drawer__eyebrow">Team access</p><h2 id="create-user-title" className="drawer__title">Create account</h2><p className="drawer__subtitle">Give a teammate secure access to the right workspace.</p></div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form className="drawer__form" onSubmit={handleSubmit}>
          <div className="drawer__section-label">Personal details</div>
          <div className="field-grid">
            <label className="field field--full"><span className="field__label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} /></label>
            <label className="field field--full"><span className="field__label">Email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label className="field"><span className="field__label">Role</span><select className="input" value={role} onChange={(e) => setRole(e.target.value)}><option value="salesperson">Salesperson</option><option value="manager">Manager</option><option value="operations">Operations</option></select></label>
            <label className="field"><span className="field__label">Temporary password</span><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required /></label>
          </div>
          <div className="drawer__section-label">Workspace access</div>
          <p className="field__hint">Choose the staff role, then set a temporary password to share securely. The backend stores only its password hash.</p>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <footer className="drawer__foot"><button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Creating…' : 'Create account'}</button></footer>
        </form>
      </section>
    </div>
  );
}
