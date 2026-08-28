/**
 * A free buying guide, readable by anyone — gating the content itself
 * behind a form would work against the same content-first thinking this
 * page is otherwise built on. The lead-magnet mechanic sits at the end
 * instead: anyone who reads this far and asks for a copy is a much more
 * qualified lead than a random visitor, which is the actual point of a
 * lead magnet — not the gate.
 *
 * Every claim below is paraphrased from the real product descriptions
 * already published on each oil's own page — nothing here is invented.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { isValidEmail, isValidPhone } from '../utils/validators';

const OILS = [
  {
    id: 'groundnut-oil-1l',
    name: 'Groundnut Oil',
    bestFor: 'Your everyday cooking oil',
    when: 'Frying, tempering, and anything that needs high heat',
    why: 'A high smoke point makes it the one most Indian kitchens reach for daily — kachi ghani pressed from sun-dried, hand-picked groundnuts.',
  },
  {
    id: 'sesame-oil-1l',
    name: 'Sesame (Til) Oil',
    bestFor: 'South Indian and Ayurvedic cooking',
    when: 'Tempering, finishing a dish, oil-pulling, or an abhyanga massage',
    why: 'Wood-pressed from black and white til seeds for a rich, nutty aroma — the oil most associated with traditional South Indian and Ayurvedic kitchens.',
  },
  {
    id: 'coconut-oil-1l',
    name: 'Coconut Oil',
    bestFor: 'One oil for cooking, skin and hair',
    when: "You'd rather buy one bottle than three",
    why: 'Virgin and cold-pressed from farm-fresh copra, without heat or chemical refining. Turning solid below 24°C is a sign of purity, not a flaw.',
  },
  {
    id: 'castor-oil-1l',
    name: 'Castor Oil',
    bestFor: 'Hair and skin care, not the kitchen',
    when: 'A hair mask, a skin treatment, or a massage oil',
    why: 'Wood-pressed at low temperature and speed to keep its natural ricinoleic acid content — popular for hair care and as a massage oil, not typically a cooking oil.',
  },
];

function validate(form) {
  const errors = {};
  if (!form.name || form.name.trim().length < 2) errors.name = 'Enter your name.';
  if (!isValidPhone(form.phone)) errors.phone = 'Enter a valid 10-digit mobile number.';
  if (form.email && !isValidEmail(form.email)) errors.email = 'That doesn’t look like a valid email — or leave it blank.';
  return errors;
}

/** Every branch ends at one of the four oils above, using only the
 * distinguishing facts already written in their own copy — this is a
 * decision tree over existing content, not a new set of claims. */
function resultFor(mainAnswer, subAnswer) {
  if (mainAnswer === 'both') return 'coconut-oil-1l';
  if (mainAnswer === 'cooking') {
    if (subAnswer === 'everyday' || subAnswer === 'unsure') return 'groundnut-oil-1l';
    if (subAnswer === 'south-indian') return 'sesame-oil-1l';
  }
  if (mainAnswer === 'hairskin') {
    if (subAnswer === 'only') return 'castor-oil-1l';
    if (subAnswer === 'double') return 'coconut-oil-1l';
  }
  return null;
}

const QUIZ_OPTION_STYLE = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  marginBottom: 8,
};

export default function OilGuide() {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mainAnswer, setMainAnswer] = useState(null);
  const [subAnswer, setSubAnswer] = useState(null);

  function resetQuiz() {
    setMainAnswer(null);
    setSubAnswer(null);
  }

  const resultId = resultFor(mainAnswer, subAnswer);
  const resultOil = resultId ? OILS.find((o) => o.id === resultId) : null;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setLoading(true);
    setStatus(null);
    try {
      await api.submitContact({
        name: form.name,
        phone: form.phone,
        // The contact form requires an email; a guide request usually
        // won't have one to hand, so a placeholder null-address is used
        // rather than turning an optional field into a hard stop.
        email: form.email || 'no-email-given@westerngodsorganic.com',
        subject: 'Free guide: How to Choose Your First Cold-Pressed Oil',
        message: `Requested a copy of the oil-buying guide.${form.email ? '' : ' No email given — reach out on WhatsApp/phone.'}`,
      });
      setStatus('sent');
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="policy-page">
      <div className="breadcrumb">Home / Free Guide</div>
      <span className="eyebrow">Free guide</span>
      <h1>How to Choose Your First Cold-Pressed Oil</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Four oils, four different jobs. Here's the short version of which one to reach for —
        no signup required to read it.
      </p>

      <div style={{ background: 'var(--cream-deep)', borderRadius: 'var(--radius-md)', padding: '22px 22px 20px', maxWidth: 480 }}>
        <span className="eyebrow">Faster than reading</span>
        {!resultOil ? (
          !mainAnswer ? (
            <>
              <h3 style={{ marginTop: 0 }}>What do you mainly want it for?</h3>
              <button type="button" className="btn btn-outline" style={QUIZ_OPTION_STYLE} onClick={() => setMainAnswer('cooking')}>
                Cooking
              </button>
              <button type="button" className="btn btn-outline" style={QUIZ_OPTION_STYLE} onClick={() => setMainAnswer('hairskin')}>
                Hair or skin care
              </button>
              <button type="button" className="btn btn-outline" style={{ ...QUIZ_OPTION_STYLE, marginBottom: 0 }} onClick={() => setMainAnswer('both')}>
                A bit of both
              </button>
            </>
          ) : mainAnswer === 'cooking' ? (
            <>
              <h3 style={{ marginTop: 0 }}>What kind of cooking?</h3>
              <button type="button" className="btn btn-outline" style={QUIZ_OPTION_STYLE} onClick={() => setSubAnswer('everyday')}>
                Everyday frying and tempering
              </button>
              <button type="button" className="btn btn-outline" style={QUIZ_OPTION_STYLE} onClick={() => setSubAnswer('south-indian')}>
                South Indian tempering, oil-pulling, or Ayurvedic use
              </button>
              <button type="button" className="btn btn-outline" style={QUIZ_OPTION_STYLE} onClick={() => setSubAnswer('unsure')}>
                Not sure — just something reliable
              </button>
              <button type="button" className="link-btn" onClick={resetQuiz}>&larr; Start over</button>
            </>
          ) : (
            <>
              <h3 style={{ marginTop: 0 }}>Only hair and skin, or should it double as a cooking oil too?</h3>
              <button type="button" className="btn btn-outline" style={QUIZ_OPTION_STYLE} onClick={() => setSubAnswer('only')}>
                Only hair and skin — never in the kitchen
              </button>
              <button type="button" className="btn btn-outline" style={QUIZ_OPTION_STYLE} onClick={() => setSubAnswer('double')}>
                I'd like it to double as a cooking oil too
              </button>
              <button type="button" className="link-btn" onClick={resetQuiz}>&larr; Start over</button>
            </>
          )
        ) : (
          <>
            <p className="muted" style={{ margin: '0 0 2px', fontSize: '0.82rem' }}>Based on your answers</p>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>{resultOil.name}</h3>
            <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--forest-deep)' }}>{resultOil.bestFor}</p>
            <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.9rem' }}><b>Reach for it when:</b> {resultOil.when}</p>
            <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.9rem' }}>{resultOil.why}</p>
            <div className="flex gap-1" style={{ alignItems: 'center' }}>
              <Link to={`/product/${resultOil.id}`} className="btn btn-gold btn-sm">See {resultOil.name}</Link>
              <button type="button" className="link-btn" onClick={resetQuiz}>Start over</button>
            </div>
          </>
        )}
      </div>

      <h2>Or compare all four yourself</h2>
      <p>
        Every one of these is pressed the same way — a wooden kolhu (kachi ghani), slow and
        at low temperature, with no chemical refining — so the difference between them isn't
        purity, it's the job each one is actually good at.
      </p>

      <div style={{ display: 'grid', gap: 16, margin: '24px 0' }}>
        {OILS.map((oil) => (
          <div
            key={oil.id}
            style={{ background: 'var(--cream-deep)', borderRadius: 'var(--radius-md)', padding: '20px 22px' }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>{oil.name}</h3>
            <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--forest-deep)' }}>{oil.bestFor}</p>
            <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.9rem' }}><b>Reach for it when:</b> {oil.when}</p>
            <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>{oil.why}</p>
            <Link to={`/product/${oil.id}`} className="btn btn-outline btn-sm">See {oil.name}</Link>
          </div>
        ))}
      </div>

      <h2>Still not sure?</h2>
      <p>
        Most kitchens end up with two: groundnut for everyday cooking, and either sesame or
        coconut for everything else. Castor is the one exception that's rarely a cooking oil at
        all — it's worth buying on its own for hair and skin, not as a kitchen staple.
      </p>

      <div
        style={{
          background: 'var(--cream-deep)',
          borderRadius: 'var(--radius-md)',
          padding: '24px 22px',
          marginTop: 32,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Want this sent to you?</h3>
        {status === 'sent' ? (
          <p style={{ margin: 0 }}>
            Got it — we'll send a copy to <b>{form.name}</b> shortly. Thanks for reading this far.
          </p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              Leave your number and we'll message you a copy of this guide to keep — and nothing
              else unless you ask us something.
            </p>
            <form onSubmit={handleSubmit} className="form-grid">
              <div className="field">
                <label>Name</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} />
                {errors.name && <div className="field-error">{errors.name}</div>}
              </div>
              <div className="field">
                <label>Phone (WhatsApp)</label>
                <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="10-digit mobile number" />
                {errors.phone && <div className="field-error">{errors.phone}</div>}
              </div>
              <div className="field">
                <label>Email (optional)</label>
                <input value={form.email} onChange={(e) => update('email', e.target.value)} />
                {errors.email && <div className="field-error">{errors.email}</div>}
              </div>
              <div className="field" style={{ alignSelf: 'end' }}>
                <button className="btn btn-gold" disabled={loading}>
                  {loading ? 'Sending…' : 'Send me a copy'}
                </button>
              </div>
            </form>
            {status && status !== 'sent' && <div className="field-error">{status}</div>}
          </>
        )}
      </div>
    </div>
  );
}
