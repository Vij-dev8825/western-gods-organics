/**
 * "How did we do?" — opened from a WhatsApp message, on a phone, by someone who
 * may have no account and no patience. One question above the fold, everything
 * else optional, and no login anywhere.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import ChakkiWheel from '../components/ChakkiWheel';

const FACES = [
  { score: 1, face: '😞', word: 'Bad' },
  { score: 2, face: '🙁', word: 'Poor' },
  { score: 3, face: '😐', word: 'Okay' },
  { score: 4, face: '🙂', word: 'Good' },
  { score: 5, face: '😄', word: 'Great' },
];

export default function Feedback() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [issues, setIssues] = useState([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.getFeedbackForm(token)
      .then((d) => {
        setData(d);
        if (d.existing) {
          setRating(d.existing.rating);
          setIssues(d.existing.issues || []);
          setComment(d.existing.comment || '');
        }
      })
      .catch((err) => setError(err.message));
  }, [token]);

  function toggleIssue(key) {
    setIssues((prev) => (prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]));
  }

  async function submit() {
    setSaving(true);
    try {
      setDone(await api.submitFeedback(token, { rating, issues, comment }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="container narrow" style={{ padding: '48px 0' }}>
        <h1>We couldn't open that link</h1>
        <p className="muted">{error}</p>
        <Link to="/" className="btn btn-outline">Back to the shop</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state" style={{ padding: '64px 0' }}>
        <ChakkiWheel size={60} />
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (done) {
    const unhappy = rating <= 3 || issues.length > 0;
    return (
      <div className="container narrow" style={{ padding: '48px 0', maxWidth: 560 }}>
        <h1 style={{ marginTop: 0 }}>Thank you</h1>
        <p>
          {unhappy
            ? "That's gone straight to the mill and someone will look at it. If it needs putting right, we'd rather know now than not at all."
            : "That's gone straight to the mill — it means a lot to a small press."}
        </p>
        {/* Offered to everyone, whatever they just said. Showing this only to
            happy customers would be review-gating. */}
        {done.reviewProductId && (
          <div className="form-card" style={{ marginTop: 22 }}>
            <h4 style={{ marginTop: 0 }}>Would you tell other shoppers too?</h4>
            <p className="muted" style={{ fontSize: '0.88rem' }}>
              A line or two about the {done.reviewProductName} — good or bad — helps
              the next person decide.
            </p>
            <Link to={`/product/${done.reviewProductId}`} className="btn btn-gold">
              Write a review
            </Link>
          </div>
        )}
        <p style={{ marginTop: 22 }}>
          <Link to="/" className="link-btn">Back to the shop</Link>
        </p>
      </div>
    );
  }

  const items = data.order.items || [];

  return (
    <div className="container narrow" style={{ padding: '40px 0 64px', maxWidth: 560 }}>
      <span className="eyebrow">Order {data.order.orderNumber}</span>
      <h1 style={{ marginTop: 8 }}>How did we do?</h1>
      <p className="muted">
        This comes straight to {data.businessName} — it isn't published anywhere.
        {items.length > 0 && (
          <> You ordered {items.map((i) => `${i.name} (${i.size})`).join(', ')}.</>
        )}
      </p>

      <div className="form-card" style={{ marginTop: 20 }}>
        <h4 style={{ marginTop: 0 }}>Overall</h4>
        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
          {FACES.map((f) => (
            <button
              key={f.score}
              type="button"
              onClick={() => setRating(f.score)}
              aria-pressed={rating === f.score}
              className={rating === f.score ? 'btn btn-forest' : 'btn btn-outline'}
              style={{ flex: '1 1 84px', flexDirection: 'column', lineHeight: 1.3, padding: '10px 6px' }}
            >
              <span style={{ fontSize: '1.5rem', display: 'block' }} aria-hidden="true">{f.face}</span>
              <span style={{ fontSize: '0.78rem' }}>{f.word}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="form-card" style={{ marginTop: 16 }}>
        <h4 style={{ marginTop: 0 }}>Anything go wrong? <span className="muted">(optional)</span></h4>
        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
          {Object.entries(data.issues).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleIssue(key)}
              aria-pressed={issues.includes(key)}
              className={issues.includes(key) ? 'btn btn-forest btn-sm' : 'btn btn-outline btn-sm'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-card" style={{ marginTop: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="feedback-comment">Tell us more <span className="muted">(optional)</span></label>
          <textarea
            id="feedback-comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="In English or Tamil — whichever is easier"
          />
        </div>
      </div>

      <button
        type="button"
        className="btn btn-gold"
        style={{ marginTop: 18, width: '100%' }}
        disabled={!rating || saving}
        onClick={submit}
      >
        {saving ? 'Sending…' : rating ? 'Send it to the mill' : 'Choose a rating first'}
      </button>
    </div>
  );
}
