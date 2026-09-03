/** A random, anonymous per-browser id — no account, no PII, just enough to
 * tell "the same browser came back today" from "a new one arrived" so the
 * admin dashboard's visitor count means something. Generated once and kept
 * in localStorage, same lifetime as the recently-viewed list. */
const KEY = 'yo_visitor_id';

export function getVisitorId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // private mode / storage disabled — the beacon just won't send
  }
}
