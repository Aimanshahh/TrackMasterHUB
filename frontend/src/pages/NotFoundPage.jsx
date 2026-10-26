import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <section className="page-head page-head--error">
      <div className="container">
        <p className="eyebrow">
          <span className="eyebrow__mark" aria-hidden="true" />
          404 · Not found
        </p>
        <h1 className="page-title">This page is not part of the platform.</h1>
        <p className="page-head__body">
          The link may be out of date, or the route has not been built yet. Everything that exists
          today is reachable from the overview or the status page.
        </p>
        <div className="page-head__actions">
          <Link className="btn btn--primary" to="/">
            Back to overview
          </Link>
          <Link className="btn btn--link" to="/status">
            System status
          </Link>
        </div>
      </div>
    </section>
  );
}
