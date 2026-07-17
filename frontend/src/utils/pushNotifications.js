import { api } from '../api';

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getPushPermission() {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** Requests notification permission, registers the service worker, and
 * subscribes to push — saving the subscription server-side. Returns false
 * (without throwing) if the browser doesn't support push or the key isn't
 * configured, so callers can just hide the UI in that case. */
export async function enablePushNotifications(token) {
  if (!isPushSupported()) return false;

  const { key } = await api.getPushKey();
  if (!key) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }

  await api.subscribePush(token, subscription.toJSON());
  return true;
}

export async function disablePushNotifications(token) {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api.unsubscribePush(token, { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe();
  }
}
