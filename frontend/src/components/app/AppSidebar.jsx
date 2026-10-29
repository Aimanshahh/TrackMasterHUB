import { NavLink } from 'react-router-dom';

import { groups } from '../../app/navigation.js';
import Logo from '../brand/Logo.jsx';
import { NavIcon } from './NavIcon.jsx';

export default function AppSidebar({ open, onClose }) {
  return (
    <>
      <div className={`app-sidebar-scrim${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`app-sidebar${open ? ' is-open' : ''}`} aria-label="Admin navigation">
        <div className="app-sidebar__brand">
          <Logo size={36} subtitle="ADMIN WORKSPACE" linked={false} />
        </div>

        <nav className="app-sidebar__nav">
          {groups.map((group) => (
            <section className="app-sidebar__group" key={group.label}>
              <p className="app-sidebar__group-title">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `app-sidebar__link${isActive ? ' is-active' : ''}`}
                  onClick={onClose}
                >
                  <NavIcon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </section>
          ))}
        </nav>

        <div className="app-sidebar__foot">
          <span className="status-dot status-dot--online" aria-hidden="true" />
          <span>Workspace access is protected</span>
        </div>
      </aside>
    </>
  );
}
