import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { navigationItems } from '../../app/navigation.js';
import { roleLabels } from '../../app/roles.js';
import { useAuth } from '../../context/auth.js';
import '../styles/tokens.css';
import { useSystemHealth } from '../../context/systemHealth.js';
import NavIcon from './NavIcon.jsx';

function currentSection(pathname) {
  const matches = navigationItems
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length);

  return matches[0] ?? null;
}

export default function AppTopbar({ onOpenNav }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { status, data } = useSystemHealth();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const section = currentSection(pathname);
  const database = status === 'online' ? data?.database : null;
  const displayName = user?.name ?? 'Account';
  const initial = displayName.trim().charAt(0).toUpperCase();

  async function handleSignOut() {
    setProfileOpen(false);
    await logout();
    navigate('/sign-in', { replace: true });
  }

  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return undefined;

    function onPointerDown(event) {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') setProfileOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  return (
    <header className="app-topbar">
      <div className="app-topbar__left">
        <button
          type="button"
          className="app-topbar__menu"
          onClick={onOpenNav}
          aria-label="Open navigation"
        >
          <NavIcon name="menu" size={20} />
        </button>

        <p className="app-crumb">
          <span className="app-crumb__root">Admin</span>
          <span className="app-crumb__sep" aria-hidden="true">
            /
          </span>
          <span className="app-crumb__current">{section?.label ?? 'Workspace'}</span>
        </p>
      </div>

      <div className="app-topbar__right">
        <p className="app-topbar__date">
          {new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }).format(new Date())}
        </p>

        <Link
          to="/admin/settings"
          className="app-health"
          title={
            database?.status === 'operational'
              ? `MongoDB operational · ${database.database}`
              : 'Database connection unavailable'
          }
        >
          <span
            className={`status-dot status-dot--${database?.status === 'operational' ? 'online' : database?.status === 'connecting' ? 'loading' : 'offline'}`}
            aria-hidden="true"
          />
          <span className="app-health__label">
            {database?.status === 'operational' ? 'Live data' : 'Data offline'}
          </span>
        </Link>

        <div className="app-profile-wrap" ref={profileRef}>
          <button
            type="button"
            className="app-profile"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className="app-profile__avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="app-profile__text">
              <span className="app-profile__name">{displayName}</span>
              <span className="app-profile__role">{roleLabels[user?.role] ?? 'Account'}</span>
            </span>
            <NavIcon name="chevron" size={15} className="app-profile__chevron" />
          </button>

          {profileOpen ? (
            <div className="app-menu" role="menu">
              <div className="app-menu__head">
                <p className="app-menu__title">{displayName}</p>
                <p className="app-menu__note">
                    {user?.email} · {roleLabels[user?.role] ?? user?.role}
                    <span className="session-ttl">
                      <span className="session-ttl__label">session ends</span>
                      <span className="session-ttl__value">7 days</span>
                    </span>
                  </p>
              </div>
              <ul className="app-menu__list">
                <li className="app-menu__item" role="menuitem">
                  <Link to="/admin/settings">Workspace settings</Link>
                </li>
                <li className="app-menu__item" role="menuitem">
                  <Link to="/status">System status page</Link>
                </li>
                <li className="app-menu__item" role="menuitem">
                  <Link to="/welcome">View public introduction</Link>
                </li>
              </ul>
              <button
                type="button"
                className="app-menu__item app-menu__action"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
