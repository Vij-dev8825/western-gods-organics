import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n';

const SUPPORT_PHONE = '+919000000000';
const SUPPORT_EMAIL = 'hello@yamunaorganics.com';

function FooterAccordion({ title, isOpen, onToggle, children }) {
  return (
    <div className="footer-accordion">
      <button
        type="button"
        className="footer-accordion-head"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <span className={`footer-accordion-chevron ${isOpen ? 'open' : ''}`}>▾</span>
      </button>
      <div className={`footer-accordion-body ${isOpen ? 'open' : ''}`}>{children}</div>
    </div>
  );
}

export default function Footer() {
  const { t } = useLang();
  const [openSection, setOpenSection] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShowBackToTop(window.scrollY > 500);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function toggle(name) {
    setOpenSection((cur) => (cur === name ? null : name));
  }

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-brand-row">
          <div className="flex gap-1" style={{ alignItems: 'center', marginBottom: 14 }}>
            <img src="/favicon.svg" alt="" width={34} height={34} />
            <h3 style={{ color: '#fffdf8', margin: 0 }}>Yamuna Organic</h3>
          </div>
          <p style={{ maxWidth: 420, fontSize: '0.9rem' }}>{t('footerTagline')}</p>
          <div className="social-row">
            <a href="#" aria-label="Instagram">IG</a>
            <a href="#" aria-label="Facebook">FB</a>
            <a href="#" aria-label="WhatsApp">WA</a>
          </div>
        </div>

        <div className="footer-service-card">
          <h4>{t('footerCustomerService')}</h4>
          <a href={`tel:${SUPPORT_PHONE}`} className="footer-service-row">
            <span aria-hidden="true">📞</span> {SUPPORT_PHONE.replace('+91', '+91 ')}
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="footer-service-row">
            <span aria-hidden="true">✉️</span> {SUPPORT_EMAIL}
          </a>
          <a
            href={`https://wa.me/${SUPPORT_PHONE.replace('+', '')}`}
            target="_blank"
            rel="noreferrer"
            className="footer-service-row"
          >
            <span aria-hidden="true">💬</span> {t('footerWhatsapp')}
          </a>
        </div>

        <div className="footer-accordions">
          <FooterAccordion title={t('footerAbout')} isOpen={openSection === 'about'} onToggle={() => toggle('about')}>
            <p style={{ fontSize: '0.85rem' }}>{t('footerAboutText')}</p>
            <p style={{ fontSize: '0.85rem', margin: 0 }}>
              Shri Gopal Flour &amp; Oil Mills,<br />Udumalpet, Tiruppur District,<br />Tamil Nadu – 642126
            </p>
          </FooterAccordion>

          <FooterAccordion title={t('footerProducts')} isOpen={openSection === 'products'} onToggle={() => toggle('products')}>
            <ul>
              <li><Link to="/shop">{t('footerAll')}</Link></li>
              <li><Link to="/categories">{t('footerCategories')}</Link></li>
              <li><Link to="/subscriptions">{t('footerSubscriptions')}</Link></li>
              <li><Link to="/wishlist">{t('footerWishlist')}</Link></li>
            </ul>
          </FooterAccordion>

          <FooterAccordion title={t('footerB2B')} isOpen={openSection === 'b2b'} onToggle={() => toggle('b2b')}>
            <p style={{ fontSize: '0.85rem' }}>{t('footerB2BText')}</p>
            <ul>
              <li><Link to="/bulk-enquiry">{t('footerBulk')}</Link></li>
              <li><Link to="/import">{t('footerImport')}</Link></li>
            </ul>
          </FooterAccordion>

          <FooterAccordion title={t('footerPolicy')} isOpen={openSection === 'policy'} onToggle={() => toggle('policy')}>
            <ul>
              <li><Link to="/contact">{t('footerContact')}</Link></li>
              <li><Link to="/profile">{t('footerAccount')}</Link></li>
              <li><Link to="/refund-policy">{t('footerRefunds')}</Link></li>
              <li><Link to="/policy">{t('footerPrivacy')}</Link></li>
              <li><Link to="/terms">{t('footerTerms')}</Link></li>
            </ul>
          </FooterAccordion>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Yamuna Organic. {t('footerRights')}</span>
          <span>{t('footerMotto')}</span>
        </div>
      </div>

      <button
        type="button"
        className={`back-to-top ${showBackToTop ? 'visible' : ''}`}
        aria-label={t('footerBackToTop')}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        ↑
      </button>
    </footer>
  );
}
