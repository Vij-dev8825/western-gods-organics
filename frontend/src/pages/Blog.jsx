import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';
import { useLang } from '../i18n';

export default function Blog() {
  const { t } = useLang();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBlogPosts().then((d) => setPosts(d.posts)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <div className="blog-banner">
        <h1>{t('blogBannerTitle')}</h1>
        <p>{t('blogBannerSub')}</p>
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
              <Link key={p.id} to={`/blog/${p.id}`} className="blog-card">
                <div className="blog-card-media">
                  <img src={getProductImage(p.image)} alt={p.title} loading="lazy" />
                </div>
                <div className="blog-card-body">
                  {p.category && <span className="blog-card-tag">{p.category}</span>}
                  <h3>{p.title}</h3>
                  <p className="muted">{p.excerpt}</p>
                </div>
              </Link>
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
