import { NavIcon } from './NavIcon.jsx';

export default function AppSidebar({ open, onClose }) {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <NavIcon name="overview" size={22} />
        <span className="app-sidebar__title">TrackMaster Hub</span>
      </div>

      <nav className="app-sidebar__nav">
        {navigationItems.map((item) => (
          <a
            key={item.to}
            href={item.to}
            className="app-sidebar__link"
            onClick={onClose}
          >
            <NavIcon name={item.icon} size={16} />
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
