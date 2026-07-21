import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';
import BlogShare from '../components/BlogShare';
import BlogLike from '../components/BlogLike';
import { useLang } from '../i18n';

export default function Blog() {
  const { t } = useLang();
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

  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <div
        className={`blog-banner ${banner.bannerImage ? 'has-image' : ''}`}
        style={banner.bannerImage ? { backgroundImage: `url(${getProductImage(banner.bannerImage)})` } : undefined}
      >
        <h1>{banner.bannerTitle || t('blogBannerTitle')}</h1>
        <p>{banner.bannerSubtitle || t('blogBannerSub')}</p>
      </div>

      <div className="container">
        <div className="breadcrumb">{t('navHome')} / {t('navBlog')}</div>

        {loading ? (
          <div className="center" style={{ padding: '80px 0' }}>
            <ChakkiWheel size={50} />
          </div>
        ) : posts.length ? (
          <div className="blog-grid">
            {posts.map((p) => (
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
                      <span aria-hidden="true">💬</span> {p.commentsCount || 0}
                    </Link>
                  </div>
                  <BlogShare url={`${window.location.origin}/blog/${p.id}`} title={p.title} />
                </div>
              </div>
            ))}
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
