import { Link } from 'react-router-dom';

import { footerColumns } from '../../content/site.js';
import Logo from '../brand/Logo.jsx';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Logo size={44} subtitle="Track with advance technology" linked={false} />
            <p className="site-footer__blurb">
              Customer records, sales, renewals, field operations, support and billing in one
              system.
            </p>
          </div>

          <nav className="site-footer__columns" aria-label="Footer">
            {footerColumns.map((column) => (
              <div key={column.title} className="footer-column">
                <h2 className="footer-column__title">{column.title}</h2>
                <ul className="footer-column__list">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a className="footer-link" href={link.to}>
                          {link.label}
                        </a>
                      ) : (
                        <Link className="footer-link" to={link.to}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="site-footer__bottom">
          <p>© {new Date().getFullYear()} TrackMaster. Internal platform.</p>
          <p className="site-footer__build">
            Foundation build <span>v0.1.0</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
