import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n';

export default function BlogComments({ slug }) {
  const { t } = useLang();
  const { token, isLoggedIn } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.getBlogComments(slug).then((d) => setComments(d.comments)).finally(() => setLoading(false));
  }
  useEffect(load, [slug]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.addBlogComment(token, slug, text.trim());
      setText('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="blog-comments" id="comments">
      <h3 className="blog-comments-heading">
        {t('commentsHeading')} {comments.length > 0 && `(${comments.length})`}
      </h3>

      {isLoggedIn ? (
        <form className="blog-comment-form" onSubmit={submit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('commentPlaceholder')}
            rows={3}
            maxLength={1000}
          />
          {error && <div className="field-error">{error}</div>}
          <button type="submit" className="btn btn-gold btn-sm" disabled={submitting || !text.trim()}>
            {submitting ? '…' : t('commentSubmit')}
          </button>
        </form>
      ) : (
        <p className="blog-comment-login-prompt">
          <Link to="/login">{t('commentLoginPrompt')}</Link>
        </p>
      )}

      {!loading && comments.length === 0 && <p className="muted blog-comments-empty">{t('commentsEmpty')}</p>}

      <div className="blog-comment-list">
        {comments.map((c) => (
          <div key={c.id} className="blog-comment">
            <div className="blog-comment-meta">
              <b>{c.userName}</b>
              <span className="muted">{new Date(c.createdAt).toLocaleDateString()}</span>
            </div>
            <p>{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
