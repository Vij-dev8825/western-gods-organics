import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isPushSupported, getPushPermission, enablePushNotifications, disablePushNotifications } from '../utils/pushNotifications';
import ChakkiWheel from '../components/ChakkiWheel';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Notifications() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pushPermission, setPushPermission] = useState('unsupported');
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .getNotifications(token)
      .then((d) => {
        setNotifications(d.notifications);
        if (d.unread > 0) api.markAllNotificationsRead(token).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    setPushPermission(getPushPermission());
  }, []);

  async function handleEnablePush() {
    setPushBusy(true);
    try {
      const ok = await enablePushNotifications(token);
      setPushPermission(getPushPermission());
      showToast(ok ? 'Push notifications enabled on this device.' : 'Could not enable push notifications.', ok ? 'success' : 'error');
    } catch (err) {
      showToast('Could not enable push notifications.', 'error');
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    setPushBusy(true);
    try {
      await disablePushNotifications(token);
      showToast('Push notifications turned off on this device.');
    } catch (err) {
      showToast('Could not turn off push notifications.', 'error');
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720, padding: '48px 24px 80px' }}>
      <span className="eyebrow">Updates</span>
      <h1 style={{ fontSize: '2rem' }}>Notifications</h1>

      {pushPermission !== 'unsupported' && (
        <div className="alert alert-info push-prompt">
          {pushPermission === 'granted' ? (
            <>
              <span>🔔 Push notifications are enabled on this device.</span>
              <button className="btn btn-outline btn-sm" onClick={handleDisablePush} disabled={pushBusy}>
                {pushBusy ? 'Working…' : 'Turn off'}
              </button>
            </>
          ) : pushPermission === 'denied' ? (
            <span>🔕 Push notifications are blocked for this site — enable them from your browser's site settings if you'd like order updates as alerts.</span>
          ) : (
            <>
              <span>Get order updates and offers as alerts, even when the site isn't open.</span>
              <button className="btn btn-gold btn-sm" onClick={handleEnablePush} disabled={pushBusy}>
                {pushBusy ? 'Enabling…' : 'Enable notifications'}
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <ChakkiWheel size={60} />
          <p className="muted">Loading…</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <ChakkiWheel size={60} spin={false} />
          <h3>No notifications yet</h3>
          <p className="muted">Order updates, price drops and offers will appear here.</p>
        </div>
      ) : (
        <ul className="notification-list">
          {notifications.map((n) => (
            <li key={n.id} className={n.read ? '' : 'unread'}>
              <div className="notification-title">{n.title}</div>
              <p>{n.message}</p>
              <span className="notification-time">{timeAgo(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
