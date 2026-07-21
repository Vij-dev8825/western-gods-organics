import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';
import BlogShare from '../components/BlogShare';
import BlogLike from '../components/BlogLike';
import BlogComments from '../components/BlogComments';
import { useLang } from '../i18n';

export default function BlogPost() {
  const { t } = useLang();
  const { slug } = useParams();
  const location = useLocation();
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

  // React Router doesn't auto-scroll to a #hash on client-side navigation
  // (only real page loads do) — do it ourselves once the post has rendered.
  useEffect(() => {
    if (!loading && location.hash === '#comments') {
      document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, location.hash]);

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
      <div className="blog-post-actions">
        <BlogLike slug={post.id} likes={post.likes} />
        <a href="#comments" className="blog-comment-count" aria-label={t('commentsHeading')}>
          <span aria-hidden="true">💬</span> {post.commentsCount ?? 0}
        </a>
        <BlogShare url={window.location.href} title={post.title} />
      </div>

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

      <BlogComments slug={post.id} />
    </div>
  );
}
