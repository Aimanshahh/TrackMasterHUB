import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { roleLabels } from '../../app/roles.js';
import { useAuth } from '../../context/auth.js';
import { useSystemHealth } from '../../context/systemHealth.js';
import NotificationBell from './NotificationBell.jsx';
import { NavIcon } from './NavIcon.jsx';

function currentSection(items, pathname) {
  return items
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

export default function AppTopbar({ workspace, onOpenNav }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { status, data } = useSystemHealth();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const section = currentSection(workspace.navItems, pathname);
  const databaseStatus = data?.checks?.database;
  const name = user?.name ?? 'Account';

  useEffect(() => setProfileOpen(false), [pathname]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const closeOnOutside = (event) => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileOpen]);

  async function signOut() {
    await logout();
    navigate('/sign-in', { replace: true });
  }

  return (
    <header className="app-topbar">
      <div className="app-topbar__left">
        <button className="app-topbar__menu" type="button" onClick={onOpenNav} aria-label="Open navigation">
          <NavIcon name="menu" size={19} />
        </button>
        <p className="app-crumb"><span>{workspace.label}</span><span aria-hidden="true">/</span><strong>{section?.label ?? 'Workspace'}</strong></p>
      </div>
      <div className="app-topbar__right">
        <span className="app-topbar__date">{new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span>
        <Link to={workspace.settingsPath} className="app-health" title={status === 'online' ? `API online · database ${databaseStatus ?? 'unknown'}` : 'API status unavailable'}>
          <span className={`status-dot status-dot--${status === 'online' ? (databaseStatus === 'operational' ? 'online' : 'offline') : 'loading'}`} aria-hidden="true" />
          <span>{databaseStatus === 'operational' ? 'Live data' : databaseStatus === 'disconnected' ? 'Database offline' : status === 'online' ? 'Database status unknown' : 'Checking'}</span>
        </Link>
        <NotificationBell />
        <div className="app-profile-wrap" ref={profileRef}>
          <button type="button" className="app-profile" aria-label={`${name}, ${roleLabels[user?.role] ?? 'Account'} — account menu`} aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
            <span className="app-profile__avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
            <span className="app-profile__text"><strong>{name}</strong><small>{roleLabels[user?.role] ?? 'Account'}</small></span>
            <NavIcon name="chevron" size={14} />
          </button>
          {profileOpen ? <div className="app-menu" role="menu">
            <div className="app-menu__head"><strong>{name}</strong><span>{user?.email}</span><small>Sessions expire after 7 days</small></div>
            <Link className="app-menu__item" role="menuitem" to={workspace.settingsPath}>Workspace settings</Link>
            <Link className="app-menu__item" role="menuitem" to="/status">System status</Link>
            <button type="button" className="app-menu__item app-menu__action" role="menuitem" onClick={signOut}>Sign out</button>
          </div> : null}
        </div>
      </div>
    </header>
  );
}
