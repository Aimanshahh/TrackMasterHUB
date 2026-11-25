import { useNavigate } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useAuth } from '../../context/auth.js';
import { useTechnicianSummary } from '../../hooks/useTechnician.js';

export default function TechnicianSettingsPage() {
  useDocumentTitle('Settings');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data } = useTechnicianSummary();

  async function signOut() {
    await logout();
    navigate('/sign-in', { replace: true });
  }

  return (
    <div className="tech-page">
      <section className="tech-section">
        <div className="tech-section__head"><h2>Account</h2></div>
        <dl className="tech-rate">
          <div><dt>Name</dt><dd>{user?.name ?? '—'}</dd></div>
          <div><dt>Email</dt><dd>{user?.email ?? '—'}</dd></div>
          <div><dt>Role</dt><dd>Technician</dd></div>
          <div><dt>Station</dt><dd>{data?.technician?.station || 'Not recorded'}</dd></div>
          <div><dt>Phone</dt><dd>{data?.technician?.phone || 'Not recorded'}</dd></div>
        </dl>
        <p className="tech-note">
          Your login is linked to one technician record, so you only ever see the installations, devices, SIMs and earnings attached to you.
        </p>
        <button type="button" className="btn btn--outline btn--small" onClick={signOut}>Sign out</button>
      </section>
    </div>
  );
}
