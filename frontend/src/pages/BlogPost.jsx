import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';
import { useLang } from '../i18n';

export default function BlogPost() {
  const { t } = useLang();
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api
      .getBlogPost(slug)
      .then((d) => setPost(d.post))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="center" style={{ padding: '96px 0' }}>
        <ChakkiWheel size={50} />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="container section empty-state">
        <ChakkiWheel size={56} spin={false} />
        <h3>{t('blogNotFound')}</h3>
        <Link className="btn btn-gold btn-sm" to="/blog">{t('blogBackToAll')}</Link>
      </div>
    );
  }

  return (
    <div className="container section blog-post">
      <div className="breadcrumb">
        {t('navHome')} / <Link to="/blog">{t('navBlog')}</Link> / {post.title}
      </div>

      {post.category && <span className="blog-card-tag">{post.category}</span>}
      <h1 className="blog-post-title">{post.title}</h1>

      {post.image && (
        <div className="blog-post-media">
          <img src={getProductImage(post.image)} alt={post.title} />
        </div>
      )}

      <div className="blog-post-body">
        {post.content.split('\n\n').map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      <Link className="btn btn-outline btn-sm" to="/blog">← {t('blogBackToAll')}</Link>
    </div>
  );
}
