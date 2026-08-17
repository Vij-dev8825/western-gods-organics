import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useLang } from '../i18n';
import { localizeProductText } from '../utils/productLocale';
import { getProductImage } from '../utils/productImages';
import { IconSearch } from './Icons';

const MAX_SUGGESTIONS = 6;

/** The catalogue, fetched once per page load and kept here rather than in
 *  state, so moving between pages doesn't re-request 25 products. Deliberately
 *  not fetched until someone actually touches the search box: most visits
 *  never use it, and this must not cost every page an extra request. */
let cache = null;
let inFlight = null;
function loadCatalogue() {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = api
      .getProducts({})
      .then((d) => { cache = d.products || []; return cache; })
      // Silent: the box still works as a plain search form without this.
      .catch(() => { inFlight = null; return []; });
  }
  return inFlight;
}

/** Everything a shopper might type at a product: its English name, its Tamil
 *  name where one is entered, its category and its tags. Sesame has to be
 *  findable as "til" and "nallennai" as well as "sesame". */
function haystack(p, lang) {
  return [
    p.name,
    localizeProductText(p, 'name', lang),
    p.category,
    ...(p.tags || []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function rank(p, q, lang) {
  const name = (localizeProductText(p, 'name', lang) || p.name || '').toLowerCase();
  if (name.startsWith(q)) return 0;          // typing the name from the start
  if (name.includes(q)) return 1;            // a word inside the name
  if (haystack(p, lang).includes(q)) return 2; // a tag, a category, the other language
  return -1;
}

export default function NavSearch({ onNavigate }) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState(
    location.pathname === '/shop' ? searchParams.get('search') || '' : ''
  );
  const [products, setProducts] = useState(cache || []);
  const [matches, setMatches] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { setMatches([]); setActive(-1); return; }
    const found = products
      .map((p) => ({ p, r: rank(p, q, lang) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r)
      .slice(0, MAX_SUGGESTIONS)
      .map((x) => x.p);
    setMatches(found);
    setActive(-1);
  }, [query, products, lang]);

  // Clicking anywhere else closes the list. Pointerdown rather than click so
  // it closes before a tap elsewhere lands, which on a phone otherwise reads
  // as the list swallowing the first tap.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  function focusIn() {
    loadCatalogue().then(setProducts);
    setOpen(true);
  }

  function go(to) {
    setOpen(false);
    inputRef.current?.blur();
    onNavigate?.();
    navigate(to);
  }

  function submit(e) {
    e.preventDefault();
    // Enter on a highlighted suggestion opens that product; Enter on the typed
    // text runs the ordinary search, which is what it has always done.
    if (active >= 0 && matches[active]) return go(`/product/${matches[active].id}`);
    const q = query.trim();
    go(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
  }

  function keyDown(e) {
    if (!open || !matches.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const showList = open && query.trim().length >= 2 && matches.length > 0;

  return (
    <div className="navbar-search-wrap" ref={boxRef}>
      <form className="navbar-search" role="search" onSubmit={submit}>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={focusIn}
          onKeyDown={keyDown}
          placeholder={t('searchPlaceholder')}
          aria-label="Search products"
          role="combobox"
          aria-expanded={showList}
          aria-controls="nav-search-list"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `nav-search-opt-${active}` : undefined}
          autoComplete="off"
        />
        <button type="submit" aria-label="Search">
          <IconSearch />
        </button>
      </form>

      {showList && (
        <ul className="search-suggest" id="nav-search-list" role="listbox" aria-label="Product suggestions">
          {matches.map((p, i) => {
            const from = Math.min(...(p.sizes || []).map((s) => Number(s.price)).filter(Number.isFinite));
            return (
              <li
                key={p.id}
                id={`nav-search-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : ''}
                onMouseEnter={() => setActive(i)}
                // pointerdown, not click: the input's blur would otherwise
                // close the list before a click could register on it.
                onPointerDown={(e) => { e.preventDefault(); go(`/product/${p.id}`); }}
              >
                <img src={getProductImage(p.image)} alt="" />
                <span className="search-suggest-name">
                  {localizeProductText(p, 'name', lang) || p.name}
                </span>
                {Number.isFinite(from) && <span className="search-suggest-price">₹{from}</span>}
              </li>
            );
          })}
          <li
            className={`search-suggest-all ${active === -1 ? '' : ''}`}
            role="option"
            aria-selected={false}
            onPointerDown={(e) => {
              e.preventDefault();
              go(`/shop?search=${encodeURIComponent(query.trim())}`);
            }}
          >
            See everything for “{query.trim()}”
          </li>
        </ul>
      )}
    </div>
  );
}
