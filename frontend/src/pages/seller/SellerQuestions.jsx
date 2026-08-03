import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function SellerQuestions() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [questions, setQuestions] = useState([]);
  const [drafts, setDrafts] = useState({});

  function load() {
    api.seller.getQuestions(token).then((d) => setQuestions(d.questions)).catch(() => {});
  }
  useEffect(load, [token]);

  async function submitAnswer(q) {
    const answer = (drafts[q.id] || '').trim();
    if (answer.length < 2) {
      showToast('Enter an answer.', 'error');
      return;
    }
    try {
      await api.seller.answerQuestion(token, q.id, answer);
      setDrafts((d) => ({ ...d, [q.id]: '' }));
      showToast('Answer posted.');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const unanswered = questions.filter((q) => !q.answer).length;

  return (
    <>
      <div className="admin-head">
        <h1>Customer Questions</h1>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 20 }}>
        Questions shoppers asked on your own products. Your answer is published publicly on that product's page.
        {unanswered > 0 && <> <b className="gold-text">{unanswered} waiting.</b></>}
      </p>

      <div className="admin-card">
        {questions.length === 0 ? (
          <p className="muted">No questions on your products yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Question</th><th>Asked</th><th>Your answer</th></tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td><b>{q.productName}</b></td>
                  <td style={{ maxWidth: 220 }}>{q.question}</td>
                  <td className="muted">{new Date(q.createdAt).toLocaleDateString('en-IN')}</td>
                  <td style={{ minWidth: 260 }}>
                    {q.answer ? (
                      <>
                        <p style={{ margin: '0 0 4px' }}>{q.answer}</p>
                        <span className="muted" style={{ fontSize: '0.75rem' }}>
                          Answered {new Date(q.answeredAt).toLocaleDateString('en-IN')}
                        </span>
                      </>
                    ) : (
                      <div className="flex gap-1" style={{ alignItems: 'flex-start' }}>
                        <textarea
                          rows={2}
                          placeholder="Write an answer…"
                          value={drafts[q.id] ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                          style={{ flex: 1 }}
                        />
                        <button className="link-btn" onClick={() => submitAnswer(q)}>Answer</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
