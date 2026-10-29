import { useLocation } from 'react-router-dom';

export default function PageHeader({ workspace }) {
  const { pathname } = useLocation();
  const page = workspace.pages.find((entry) => entry.match.test(pathname)) ?? workspace.pages[0];

  return (
    <div className="app-page-head">
      <p className="app-page-head__eyebrow">{workspace.eyebrow}</p>
      <h1>{page.title}</h1>
      <p>{page.description}</p>
    </div>
  );
}
