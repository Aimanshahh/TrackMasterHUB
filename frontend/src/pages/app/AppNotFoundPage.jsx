import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function AppNotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <div className="app-not-found">
      <p className="app-not-found__label">Workspace route</p>
      <h1 className="app-not-found__title">This workspace page is not ready yet.</h1>
      <p className="app-not-found__body">
        The role workspace is still under construction. Open the Admin workspace to see the
        complete platform.
      </p>
      <Link className="btn btn--primary" to="/admin">
        Back to admin workspace
      </Link>
    </div>
  );
}
