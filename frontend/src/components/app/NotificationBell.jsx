import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useNotifications } from '../../hooks/useNotifications.js';
import { markAllNotificationsRead, markNotificationRead } from '../../lib/api.js';
import BellIcon from './BellIcon.jsx';

function formatWhen(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const notifications = useNotifications();
  const { rows, unread, error } = notifications;

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutside = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  async function openNotification(notification) {
    setOpen(false);
    if (!notification.read) {
      try {
        await markNotificationRead(notification.id);
      } catch {
        /* The read marker is not worth blocking navigation for. */
      }
      notifications.refresh();
    }
    if (notification.link) navigate(notification.link);
  }

  async function readAll() {
    try {
      await markAllNotificationsRead();
      notifications.refresh();
    } catch {
      /* Leave the unread count in place if the request fails. */
    }
  }

  return (
    <div className="app-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="app-bell"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon size={18} />
        {unread > 0 ? <span className="app-bell__dot" aria-hidden="true" /> : null}
      </button>

      {open ? (
        <div className="app-menu app-menu--notifications" role="menu">
          <div className="app-menu__head app-menu__head--row">
            <div>
              <strong>Notifications</strong>
              <span>{unread > 0 ? `${unread} unread` : 'All caught up'}</span>
            </div>
            {unread > 0 ? <button type="button" className="app-bell__all" onClick={readAll}>Mark all read</button> : null}
          </div>

          {error ? <p className="app-bell__empty">Notifications are unavailable right now.</p> : null}

          {!error && rows.length === 0 ? (
            <div className="app-bell__empty">
              <strong>No updates yet</strong>
              <p>Status changes on complaints and installations you own will appear here.</p>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <ul className="app-bell__list">
              {rows.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`app-bell__item${notification.read ? '' : ' is-unread'}`}
                    onClick={() => openNotification(notification)}
                  >
                    <span className="app-bell__item-top">
                      <strong>{notification.title}</strong>
                      <time>{formatWhen(notification.createdAt)}</time>
                    </span>
                    {notification.body ? <span className="app-bell__body">{notification.body}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
