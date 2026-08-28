import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ImageUploadField from '../../components/admin/ImageUploadField';

const PAGES = [
  { key: 'shop', label: 'Shop', defaultTitle: 'Shop', defaultSubtitle: 'Cold-pressed oils, soaps and powders — traditionally made, honestly priced.' },
  { key: 'categories', label: 'Categories', defaultTitle: 'Shop by category', defaultSubtitle: 'Each product is single-origin and made in-house — nothing blended, nothing outsourced.' },
  { key: 'combos', label: 'Combo Offers', defaultTitle: 'Combo Offers', defaultSubtitle: "Hand-picked bundles of our oils, soaps and powders at a better price together." },
  { key: 'gifting', label: 'Corporate & Festival Gifting', defaultTitle: 'Corporate & Festival Gifting', defaultSubtitle: 'Thoughtful, natural gifting for festivals, weddings and your team — from a single hamper to a few hundred.' },
  { key: 'contact', label: 'Contact Us', defaultTitle: "We'd love to hear from you", defaultSubtitle: "Questions about an order, a product, or just want to say hello — reach us any way that's easy for you." },
  { key: 'bulk-enquiry', label: 'Bulk Enquiry', defaultTitle: 'Stock our oils in your store or kitchen', defaultSubtitle: 'We supply restaurants, retailers, gyms (for massage oils), and distributors across India in 5L, 15L and 35L containers, with GST invoicing and flexible delivery schedules.' },
  { key: 'store-locator', label: 'Visit Us', defaultTitle: 'Visit Us', defaultSubtitle: 'Come see where your oils are pressed, straight from the source.' },
];

function PageBannerCard({ page }) {
  const { token } = useAuth();
  const [banner, setBanner] = useState({ bannerImage: '', bannerTitle: '', bannerSubtitle: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.admin
      .getPageBanner(token, page.key)
      .then((d) =>
        setBanner({
          bannerImage: d.settings.bannerImage || '',
          bannerTitle: d.settings.bannerTitle || '',
          bannerSubtitle: d.settings.bannerSubtitle || '',
        })
      )
      .catch(() => {});
  }, [token, page.key]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await api.admin.updatePageBanner(token, page.key, banner);
      setMessage({ type: 'success', text: 'Banner updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card">
      <h3>{page.label} page banner</h3>
      <p className="muted" style={{ marginBottom: 14 }}>
        Leave title/subtitle empty to use the default copy ("{page.defaultTitle}"); filling them in overrides it.
      </p>
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      <ImageUploadField
        value={banner.bannerImage}
        onChange={(url) => setBanner((b) => ({ ...b, bannerImage: url }))}
        label="Banner background"
      />
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`banner-title-${page.key}`}>Title override (optional)</label>
          <input
            id={`banner-title-${page.key}`}
            value={banner.bannerTitle}
            onChange={(e) => setBanner((b) => ({ ...b, bannerTitle: e.target.value }))}
            placeholder={`Default: "${page.defaultTitle}"`}
          />
        </div>
        <div className="field">
          <label htmlFor={`banner-subtitle-${page.key}`}>Subtitle override (optional)</label>
          <input
            id={`banner-subtitle-${page.key}`}
            value={banner.bannerSubtitle}
            onChange={(e) => setBanner((b) => ({ ...b, bannerSubtitle: e.target.value }))}
            placeholder={`Default: ${page.defaultSubtitle.slice(0, 40)}…`}
          />
        </div>
      </div>
      <button type="button" className="btn btn-gold btn-sm" disabled={saving} onClick={save}>
        {saving ? 'Saving…' : 'Save banner'}
      </button>
    </div>
  );
}

export default function AdminPageBanners() {
  return (
    <>
      <div className="admin-head">
        <h1>Page Banners</h1>
      </div>
      <p className="muted">
        Background image and title/subtitle overrides for the top banner of each of these pages.
      </p>
      {PAGES.map((page) => (
        <PageBannerCard key={page.key} page={page} />
      ))}
    </>
  );
}
