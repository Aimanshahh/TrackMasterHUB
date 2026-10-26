import { Link } from 'react-router-dom';

const labels = {
  loading: 'Checking API',
  online: 'API online',
  offline: 'API offline',
};

export default function ApiStatusPill({ status, to = '/status' }) {
  const label = labels[status] ?? labels.loading;

  return (
    <Link
      to={to}
      className={`status-pill status-pill--${status}`}
      title={`${label} — open system status`}
    >
      <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
