import { useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useLang } from '../i18n';

// Instagram has no public web share-intent for arbitrary links (unlike
// Facebook/Twitter/WhatsApp) — copying the link is the honest fallback,
// since it's what a customer would actually paste into a bio, DM, or story.
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function BlogShare({ url, title }) {
  const { showToast } = useToast();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  async function handleInstagram() {
    const ok = await copyToClipboard(url);
    showToast(ok ? t('shareInstagramCopied') : t('shareCopyFailed'));
    setOpen(false);
  }

  return (
    <div className="blog-share" ref={wrapRef}>
      <button
        type="button"
        className="blog-share-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        {t('shareLabel')}
        <span className={`blog-share-chevron ${open ? 'open' : ''}`} aria-hidden="true">›</span>
      </button>
      {open && (
        <div className="blog-share-menu" role="menu">
          <a
            className="blog-share-item"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Facebook
          </a>
          <a
            className="blog-share-item"
            href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            X
          </a>
          <a
            className="blog-share-item"
            href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            WhatsApp
          </a>
          <button type="button" className="blog-share-item" role="menuitem" onClick={handleInstagram}>
            Instagram
          </button>
        </div>
      )}
    </div>
  );
}
