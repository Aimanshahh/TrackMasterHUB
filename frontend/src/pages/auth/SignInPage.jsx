import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import logoUrl from '../../assets/brand/trackmaster-logo.png';
import AuthSplash from '../../components/auth/AuthSplash.jsx';
import { useAuth } from '../../context/auth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { fetchAuthStatus } from '../../lib/api.js';
import { homeFor } from '../../app/roles.js';

/** One screen for both states: first run creates the first Admin account,
 * afterwards it is a normal sign-in. There is no self-signup — accounts are
 * created by an admin, so the only path in is the login form. */
export default function SignInPage() {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { status, user, login, completeFirstRun } = useAuth();

  const [setup, setSetup] = useState(null); // null = checking
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read the incoming from= URL param synchronously, before the auth check
  // settles, so a fresh /sign-in?from=... is not lost.
  const fromParam = searchParams.get('from');

  useEffect(() => {
    const controller = new AbortController();

    fetchAuthStatus({ signal: controller.signal })
      .then((payload) => setSetup(payload.data.setupRequired))
      .catch((error_) => setSetup(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && user) {
      const from = fromParam ?? searchParams.get('from');
      const target = from && from.startsWith('/') ? from : null;
      navigate(target ?? homeFor(user.role), { replace: true });
    }
  }, [status, user, navigate, fromParam, searchParams]);

  if (status === 'loading' || setup === null) {
    return <AuthSplash label={setup === null ? 'Preparing sign-in…' : 'Checking your session…'} />;
  }

  const isSetup = setup;

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (isSetup) {
      if (form.name.trim().length < 2) {
        setError('Enter the administrator name.');
        return;
      }
    }

    if (!form.email.trim()) {
      setError('Enter your email address.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const user = isSetup
        ? await completeFirstRun({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
          })
        : await login(form.email.trim(), form.password);

      const from = searchParams.get('from');
      const target = from && from.startsWith('/') ? from : null;
      navigate(target ?? homeFor(user.role), { replace: true });
    } catch (error_) {
      setError(error_.message || 'Sign-in failed. Try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand__top">
          <img className="auth-brand__logo" src={logoUrl} width="54" height="54" alt="" />
          <div>
            <p className="auth-brand__name">TrackMaster Hub</p>
            <p className="auth-brand__sub">Vehicle CRM &amp; operations</p>
          </div>
        </div>

        <div className="auth-brand__body">
          <p className="auth-brand__statement">
            Every customer, renewal and job in one <span>clear</span> system.
          </p>
          <p className="auth-brand__note">
            Access is decided by your role on the server, not by the address you type. A salesperson
            sees their own portfolio; the admin sees the business.
          </p>
        </div>

        <p className="auth-brand__foot">No self-signup · accounts are issued by the admin</p>
      </aside>

      <main className="auth-panel" id="main">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <p className="auth-form__eyebrow">{isSetup ? 'First run' : 'Sign in'}</p>
          <h1 className="auth-form__title">
            {isSetup ? 'Create the admin account' : 'Welcome back'}
          </h1>
          <p className="auth-form__desc">
            {isSetup
              ? 'This workspace has no accounts yet. The account you create now becomes the first admin — it can then create salesperson, manager and operations logins.'
              : 'Use the account your admin issued. Every request is checked against your role and ownership on the server.'}
          </p>

          {isSetup ? (
            <label className="field field--full">
              <span className="field__label">Your name</span>
              <input
                className="input"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                maxLength={80}
                autoComplete="name"
              />
            </label>
          ) : null}

          <label className="field field--full">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              maxLength={160}
              autoComplete="username"
            />
          </label>

          <label className="field field--full">
            <span className="field__label">Password</span>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              maxLength={128}
              autoComplete={isSetup ? 'new-password' : 'current-password'}
            />
            <span className="field__hint">
              {isSetup
                ? 'At least 8 characters. Stored as a hash — nobody, including the app, can read it back.'
                : 'At least 8 characters.'}
            </span>
          </label>

          {error ? (
            <p className="form-alert" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn btn--primary auth-form__submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isSetup
                ? 'Creating account…'
                : 'Signing in…'
              : isSetup
                ? 'Create admin account'
                : 'Sign in'}
          </button>

          <p className="auth-form__foot">
            {isSetup
              ? 'After this, sign-in is required for every workspace, including /admin.'
              : 'Need an account? Only an admin can create one, from Settings → Users.'}
          </p>
        </form>
      </main>
    </div>
  );
}
