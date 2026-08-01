import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';
import BlogShare from '../components/BlogShare';
import BlogLike from '../components/BlogLike';
import SeoMeta from '../components/SeoMeta';
import { useLang } from '../i18n';

// Guides are just blog posts tagged with this category — /guides reuses this
// whole page (banner, likes, comments, share) filtered down to them, rather
// than duplicating the listing UI for what's really the same content type.
export const GUIDE_CATEGORY = 'Usage Guide';

export default function Blog() {
  const { t } = useLang();
  const location = useLocation();
  const isGuidesRoute = location.pathname.startsWith('/guides');
  const [posts, setPosts] = useState([]);
  const [banner, setBanner] = useState({ bannerImage: '', bannerTitle: '', bannerSubtitle: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getBlogPosts()
      .then((d) => {
        setPosts(d.posts);
        setBanner({
          bannerImage: d.bannerImage || '',
          bannerTitle: d.bannerTitle || '',
          bannerSubtitle: d.bannerSubtitle || '',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const visiblePosts = isGuidesRoute ? posts.filter((p) => p.category === GUIDE_CATEGORY) : posts;

  return (
    <div className="section" style={{ paddingTop: 0 }}>
      {isGuidesRoute ? (
        <SeoMeta
          title="Usage Guides — How to Use Our Cold-Pressed Oils & Herbal Products | Western Gods Organics"
          description="Practical, step-by-step guides for getting the most out of our cold-pressed oils, herbal soaps, and powders."
          path="/guides"
        />
      ) : (
        <SeoMeta
          title="Blog — Cold-Pressed Oils, Herbal Soaps & Ayurvedic Living | Western Gods Organics"
          description="Articles on traditional wood-pressed oils, handmade herbal soaps, herbal powders, and Ayurvedic wellness rituals from Western Gods Organics."
          path="/blog"
        />
      )}
      <div
        className={`page-banner ${banner.bannerImage ? 'has-image' : ''}`}
        style={banner.bannerImage ? { backgroundImage: `url(${getProductImage(banner.bannerImage)})` } : undefined}
      >
        <h1>{isGuidesRoute ? 'Usage Guides' : banner.bannerTitle || t('blogBannerTitle')}</h1>
        <p>{isGuidesRoute ? 'Practical, step-by-step ways to get the most from what you bought.' : banner.bannerSubtitle || t('blogBannerSub')}</p>
      </div>

      <div className="container">
        <div className="breadcrumb">{t('navHome')} / {isGuidesRoute ? 'Usage Guides' : t('navBlog')}</div>

        {loading ? (
          <div className="center" style={{ padding: '80px 0' }}>
            <ChakkiWheel size={50} />
          </div>
        ) : visiblePosts.length ? (
          <div className="blog-grid">
            {visiblePosts.map((p) => (
              <div key={p.id} className="blog-card">
                <Link to={`/blog/${p.id}`} className="blog-card-link">
                  <div className="blog-card-media">
                    <img src={getProductImage(p.image)} alt={p.title} loading="lazy" />
                  </div>
                  <div className="blog-card-body">
                    {p.category && <span className="blog-card-tag">{p.category}</span>}
                    <h3>{p.title}</h3>
                    <p className="muted">{p.excerpt}</p>
                  </div>
                </Link>
                <div className="blog-card-share">
                  <div className="blog-card-share-left">
                    <BlogLike slug={p.id} likes={p.likes} />
                    <Link to={`/blog/${p.id}#comments`} className="blog-comment-count" aria-label={t('commentsHeading')}>
                      <span className="blog-comment-icon" aria-hidden="true">💬</span> {p.commentsCount || 0}
                    </Link>
                  </div>
                  <BlogShare url={`${window.location.origin}/blog/${p.id}`} title={p.title} />
                </div>
              </div>
            ))}
          </div>
        ) : isGuidesRoute ? (
          <div className="empty-state">
            <ChakkiWheel size={56} spin={false} />
            <h3>No usage guides yet</h3>
            <p className="muted">Check back soon — we're adding practical how-to guides for our products.</p>
          </div>
        ) : (
          <div className="empty-state">
            <ChakkiWheel size={56} spin={false} />
            <h3>{t('blogEmpty')}</h3>
            <p className="muted">{t('blogEmptySub')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
