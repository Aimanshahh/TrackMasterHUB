import { NavIcon } from '../../components/app/NavIcon.jsx';
import { useNavigate } from 'react-router-dom';

const screens = [
  { to: '/admin', label: 'Overview', icon: 'overview' },
  { to: '/admin/customers', label: 'Customers', icon: 'customers' },
  { to: '/admin/follow-ups', label: 'Follow-ups', icon: 'followup' },
  { to: '/admin/sales', label: 'Sales', icon: 'sales' },
  { to: '/admin/operations', label: 'Operations', icon: 'operations' },
  { to: '/admin/complaints', label: 'Complaints', icon: 'complaints' },
  { to: '/admin/reports', label: 'Reports', icon: 'reports' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
];

export default function RoleWorkspacePage() {
  const navigate = useNavigate();

  return (
    <div className="role-workspace">
      <header className="role-workspace__header">
        <h1 className="role-workspace__title">Role workspace</h1>
        <p className="role-workspace__subtitle">This workspace is under construction. It will show the interface that matches your role.</p>
      </header>

      <nav className="role-workspace__screens">
        {screens.map((screen) => (
          <button
            key={screen.to}
            type="button"
            className="role-workspace__screen"
            onClick={() => navigate(screen.to)}
          >
            <NavIcon name={screen.icon} size={18} />
            <span>{screen.label}</span>
          </button>
        ))}
      </nav>

      <p className="role-workspace__note">
        The role-aware screens are not yet in place. Sign in with your admin account to see the full workspace.
      </p>
    </div>
  );
}
