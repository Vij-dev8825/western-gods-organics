import { useState } from 'react';
import { useLang, LANGS } from '../i18n';

const SEEN_KEY = 'yo_welcome_seen';

/** First-visit popup asking new visitors to pick a language, rather than
 * relying on them noticing the small selector in the navbar/footer. Country
 * is left to auto-detect (defaults to India) — not asked here, so this
 * doesn't add an extra decision new visitors weren't expecting. Shown once
 * ever (per browser); changing your mind later is just the navbar/footer
 * dropdowns. */
export default function WelcomeSelector() {
  const { lang, setLang, t } = useLang();
  const [visible, setVisible] = useState(() => !localStorage.getItem(SEEN_KEY));
  const [selectedLang, setSelectedLang] = useState(lang);

  function confirm() {
    setLang(selectedLang);
    localStorage.setItem(SEEN_KEY, '1');
    setVisible(false);
  }

  function dismiss() {
    localStorage.setItem(SEEN_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="welcome-selector-overlay" role="dialog" aria-modal="true" aria-label="Choose language">
      <div className="welcome-selector-card">
        <button className="welcome-selector-close" aria-label="Close" onClick={dismiss}>×</button>
        <span className="welcome-selector-badge">🌏 Welcome</span>
        <h3>{t('welcomeSelectorTitle')}</h3>
        <p className="muted">{t('welcomeSelectorSub')}</p>

        <div className="field">
          <label>{t('welcomeSelectorLangLabel')}</label>
          <select className="select" value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <button type="button" className="btn btn-gold btn-block" onClick={confirm}>
          {t('welcomeSelectorConfirm')}
        </button>
      </div>
    </div>
  );
}
