import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';
import BlogShare from '../components/BlogShare';
import BlogLike from '../components/BlogLike';
import BlogComments from '../components/BlogComments';
import SeoMeta from '../components/SeoMeta';
import { CANONICAL_ORIGIN } from '../utils/site';
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
  // A short delay/retry is needed since the target element mounts in the
  // same commit as `post` becoming truthy, but querying for it synchronously
  // in the effect can still run a tick before layout has settled.
  useEffect(() => {
    if (location.hash !== '#comments' || !post) return;
    const timer = setTimeout(() => {
      document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timer);
  }, [location.hash, post]);

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

  const rawImage = post.image ? getProductImage(post.image) : '';
  const resolvedImage = rawImage && (/^[a-z][a-z0-9+.-]*:/i.test(rawImage) ? rawImage : `${CANONICAL_ORIGIN}${rawImage}`);
  // Placeholder posts use an inline data: URI image — social-share crawlers
  // can't fetch that as an og:image, so fall back to the site logo instead
  // of a link preview with a broken picture.
  const ogImage = resolvedImage.startsWith('http') ? resolvedImage : undefined;

  return (
    <div className="container section blog-post">
      <SeoMeta
        title={`${post.title} | Western Gods Organics Blog`}
        description={(post.excerpt || '').slice(0, 160)}
        image={ogImage}
        type="article"
        path={`/blog/${post.id}`}
      />
      <div className="breadcrumb">
        {t('navHome')} / <Link to="/blog">{t('navBlog')}</Link> / {post.title}
      </div>

      {post.category && <span className="blog-card-tag">{post.category}</span>}
      <h1 className="blog-post-title">{post.title}</h1>
      <div className="blog-post-actions">
        <BlogLike slug={post.id} likes={post.likes} />
        <a href="#comments" className="blog-comment-count" aria-label={t('commentsHeading')}>
          <span className="blog-comment-icon" aria-hidden="true">💬</span> {post.commentsCount ?? 0}
        </a>
        <BlogShare url={window.location.href} title={post.title} />
      </div>

      {post.image && (
        <div className="blog-post-media">
          <img src={getProductImage(post.image)} alt={post.title} loading="eager" />
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
