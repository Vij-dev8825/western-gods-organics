import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';

const DISMISSED_KEY = 'yo_install_prompt_dismissed';
const SHOW_DELAY_MS = 6000;

/** Soft, dismissible ask to install the PWA ("Add to Home Screen"), shown once
 * Chrome/Edge/Android fire beforeinstallprompt — meaning the manifest +
 * service worker installability criteria are already met (see main.jsx,
 * public/manifest.json, public/sw.js) — and the visitor hasn't dismissed or
 * already installed it before. There's no equivalent programmatic prompt on
 * iOS Safari, so this simply never appears there; that's expected, not a bug. */
export default function InstallPrompt() {
  const { showToast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return undefined;

    let timer;
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
      timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }
    function handleAppInstalled() {
      localStorage.setItem(DISMISSED_KEY, '1');
      setVisible(false);
      setDeferredPrompt(null);
      showToast("App installed — find it on your home screen.");
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    setBusy(true);
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      // ignore — the browser's own install dialog handles cancellation
    } finally {
      localStorage.setItem(DISMISSED_KEY, '1');
      setDeferredPrompt(null);
      setBusy(false);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Install app">
      <button className="install-prompt-close" aria-label="Dismiss" onClick={dismiss}>×</button>
      <span className="install-prompt-icon" aria-hidden="true">📲</span>
      <p>Install Western Gods Organics for quicker access &amp; offline browsing</p>
      <div className="install-prompt-actions">
        <button type="button" className="btn btn-gold btn-sm" disabled={busy} onClick={install}>
          {busy ? 'Opening…' : 'Install'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
