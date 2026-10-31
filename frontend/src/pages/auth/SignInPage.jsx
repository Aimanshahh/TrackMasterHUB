import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import logoUrl from '../../assets/brand/trackmaster-logo.png';
import AuthSplash from '../../components/auth/AuthSplash.jsx';
import { homeFor, roleLabels } from '../../app/roles.js';
import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchAuthStatus } from '../../lib/api.js';

/** A `from` path is only honoured when it belongs to the role that just signed
 * in; otherwise the user is sent to their own workspace. */
function resolveTarget(from, role) {
  const home = homeFor(role);
  if (!from || !from.startsWith('/') || from.startsWith('//')) return home;
  return from === home || from.startsWith(`${home}/`) || from.startsWith(`${home}?`) ? from : home;
}

export default function SignInPage() {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status, user, login, completeFirstRun, logout } = useAuth();
  const [setup, setSetup] = useState(null);
  const [setupError, setSetupError] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const from = searchParams.get('from');

  useEffect(() => {
    const controller = new AbortController();
    fetchAuthStatus({ signal: controller.signal })
      .then((payload) => setSetup(Boolean(payload.data.setupRequired ?? !payload.data.exists)))
      .catch((error_) => {
        if (error_.name === 'AbortError') return;
        setSetup(false);
        setSetupError(error_.message);
      });
    return () => controller.abort();
  }, []);

  if (status === 'loading' || setup === null) return <AuthSplash label="Preparing secure sign-in…" />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (setup && form.name.trim().length < 2) return setError('Enter the administrator name.');
    if (!form.email.trim()) return setError('Enter your email address.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');

    setIsSubmitting(true);
    try {
      const signedInUser = setup
        ? await completeFirstRun({ name: form.name.trim(), email: form.email.trim(), password: form.password })
        : await login(form.email.trim(), form.password);
      navigate(resolveTarget(from, signedInUser.role), { replace: true });
    } catch (error_) {
      setError(error_.message || 'Sign-in failed. Check the credentials and try again.');
      setIsSubmitting(false);
    }
  }

  async function useAnotherAccount() {
    setError(null);
    setSwitching(true);
    await logout();
    setForm((current) => ({ ...current, password: '' }));
    setSwitching(false);
  }

  const alreadySignedIn = status === 'authenticated' && user;
  const continuePath = alreadySignedIn ? resolveTarget(from, user.role) : '/';

  return <div className="auth-page">
    <aside className="auth-brand">
      <div className="auth-brand__top">
        <img className="auth-brand__logo" src={logoUrl} width="54" height="54" alt="" />
        <div>
          <p className="auth-brand__name">TrackMaster Hub</p>
          <p className="auth-brand__sub">Vehicle CRM &amp; operations</p>
        </div>
      </div>
      <div className="auth-brand__body">
        <p className="auth-brand__statement">Every customer, renewal and job in one <span>clear</span> system.</p>
        <p className="auth-brand__note">
          One secure workspace for customers, team accounts and operations. Your role is verified by the
          server after sign-in.
        </p>
      </div>
      <p className="auth-brand__foot">No self-signup · staff accounts are issued by the admin</p>
    </aside>

    <main className="auth-panel" id="main">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <p className="auth-form__eyebrow">{setup ? 'First-time setup' : 'Secure access'}</p>
        <h1 className="auth-form__title">{setup ? 'Create the admin account' : 'Welcome back'}</h1>
        <p className="auth-form__desc">
          {setup
            ? 'This database does not yet contain an account. Create the first administrator to begin; only the admin can issue other staff logins.'
            : 'Sign in with the account issued to you. The system opens the correct role workspace after verifying your credentials.'}
        </p>

        {alreadySignedIn ? (
          <div className="auth-session">
            <p className="auth-session__eyebrow">Session still open</p>
            <p className="auth-session__line">
              <strong>{user.name}</strong>
              <span>{roleLabels[user.role] ?? 'Account'}</span>
              <span className="auth-session__mail">{user.email}</span>
            </p>
            <div className="auth-session__actions">
              <Link className="btn btn--primary btn--small" to={continuePath}>Continue to workspace</Link>
              <button type="button" className="btn btn--outline btn--small" onClick={useAnotherAccount} disabled={switching}>
                {switching ? 'Signing out…' : 'Use another account'}
              </button>
            </div>
            <p className="auth-session__hint">
              Signing in below replaces this session — no need to sign out first.
            </p>
          </div>
        ) : null}

        {setupError ? (
          <p className="form-alert" role="alert">
            Cannot verify account setup: {setupError}. Start the backend and confirm MongoDB is available.
          </p>
        ) : null}

        {setup ? (
          <label className="field field--full">
            <span className="field__label">Administrator name</span>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))}
              autoComplete="name"
              maxLength={80}
            />
          </label>
        ) : null}

        <label className="field field--full">
          <span className="field__label">Email</span>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))}
            autoComplete="username"
            maxLength={160}
            required
          />
        </label>

        <label className="field field--full">
          <span className="field__label">Password</span>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))}
            autoComplete={setup ? 'new-password' : 'current-password'}
            maxLength={128}
            required
          />
          <span className="field__hint">Minimum 8 characters. Passwords are stored as secure hashes.</span>
        </label>

        {error ? <p className="form-alert" role="alert">{error}</p> : null}

        <button type="submit" className="btn btn--primary auth-form__submit" disabled={isSubmitting}>
          {isSubmitting
            ? (setup ? 'Creating account…' : 'Signing in…')
            : (setup ? 'Create admin account' : 'Sign in')}
        </button>
        <p className="auth-form__foot">
          {setup
            ? 'You will enter the Admin workspace once setup succeeds.'
            : 'Need an account? Ask your administrator to create one.'}
        </p>
      </form>
    </main>
  </div>;
}
