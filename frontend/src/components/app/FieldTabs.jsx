import { NavLink } from 'react-router-dom';

import { NavIcon } from './NavIcon.jsx';

/** Phone-first primary navigation; hidden on wider screens where the sidebar wins. */
export default function FieldTabs({ tabs }) {
  return (
    <nav className="field-tabs" aria-label="Primary">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `field-tabs__link${isActive ? ' is-active' : ''}`}
        >
          <NavIcon name={tab.icon} size={19} />
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
