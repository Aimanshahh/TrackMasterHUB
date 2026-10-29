import { useLocation } from 'react-router-dom';

const pageCopy = [
  { match: /^\/admin\/?$/, title: 'Business overview', description: 'A clear view of the records and activity currently available in TrackMaster Hub.' },
  { match: /^\/admin\/customers/, title: 'Customers', description: 'Search and review customer records stored in the business database.' },
  { match: /^\/admin\/follow-ups/, title: 'Follow-ups', description: 'Review customer follow-up work recorded by the team.' },
  { match: /^\/admin\/sales/, title: 'Sales', description: 'Sales and approval information will appear here when the sales workflow is connected.' },
  { match: /^\/admin\/operations/, title: 'Operations', description: 'Work queue, technicians, station assignments and stock workflows are being prepared.' },
  { match: /^\/admin\/complaints/, title: 'Complaints', description: 'Review recorded service tickets and their resolution progress.' },
  { match: /^\/admin\/reports/, title: 'Reports', description: 'Business summaries will be available as verified records are collected.' },
  { match: /^\/admin\/pricing/, title: 'Pricing', description: 'Manage package and pricing rules in a future connected workflow.' },
  { match: /^\/admin\/users/, title: 'User access', description: 'Create and review accounts for Admin, Salesperson, Manager and Operations roles.' },
  { match: /^\/admin\/activity/, title: 'Activity log', description: 'A trace of changes recorded by the backend.' },
  { match: /^\/admin\/settings/, title: 'Settings', description: 'Workspace access and service health.' },
];

export default function PageHeader() {
  const { pathname } = useLocation();
  const page = pageCopy.find((entry) => entry.match.test(pathname)) ?? pageCopy[0];

  return <div className="app-page-head"><p className="app-page-head__eyebrow">TRACKMASTER HUB · ADMIN</p><h1>{page.title}</h1><p>{page.description}</p></div>;
}
