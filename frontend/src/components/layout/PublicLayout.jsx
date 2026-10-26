import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import SiteFooter from './SiteFooter.jsx';
import SiteHeader from './SiteHeader.jsx';

export default function PublicLayout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));

      if (target) {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
        return;
      }
    }

    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="site">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex="-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
