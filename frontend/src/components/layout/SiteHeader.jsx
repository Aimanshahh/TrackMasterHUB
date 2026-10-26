import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { navigation } from '../../content/site.js';
import { useSystemHealth } from '../../context/systemHealth.js';
import Logo from '../brand/Logo.jsx';
import ApiStatusPill from '../ui/ApiStatusPill.jsx';

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const health = useSystemHealth();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsMenuOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Logo />

        <nav className="site-nav" aria-label="Primary">
          {navigation.map((item) => (
            <Link key={item.label} className="site-nav__link" to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-header__actions">
          <ApiStatusPill status={health.status} />
          <button
            type="button"
            className="site-header__toggle"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>

      <div id="mobile-navigation" className="mobile-nav" hidden={!isMenuOpen}>
        <nav className="container mobile-nav__inner" aria-label="Primary, mobile">
          {navigation.map((item) => (
            <Link key={item.label} className="mobile-nav__link" to={item.to}>
              {item.label}
            </Link>
          ))}
          <Link className="mobile-nav__link mobile-nav__link--status" to="/status">
            System status
            <span className="mobile-nav__meta">API, version and uptime</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
