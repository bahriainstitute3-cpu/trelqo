import { useEffect, useRef, useState } from "react";
import { buildIndex, runSearch, aiParse, chipsFor, getPrice, norm } from "../lib/smartSearch";

const RECENT_KEY = "trelqo _recent_searches";
const LIVE_DELAY = 250; // ms after typing stops

function readRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.slice(0, 6) : [];
  } catch {
    return [];
  }
}
function writeRecent(list) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6))); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------
   LOCAL FAST SEARCH  (Amazon / Daraz style)
   Matches: name, Tags/Keywords (added while adding a product), brand,
   category/subcategory, colors/variants/sku, description.
   - tags are split on comma, so "airpods, handsfree, ear buds" = 3 keywords
   - word-start matching while typing ("wire" -> wireless)
   - plural/singular ("earbud" = "earbuds"), "t shirt" = "tshirt"
   - typo tolerance on every word, not only when nothing matched
   - in-stock + popular products rank higher
------------------------------------------------------------------ */

const STOP = new Set([
  "under", "below", "above", "over", "price", "rs", "pkr", "tak", "se", "kam", "zyada", "ziada",
  "in", "for", "the", "a", "an", "of", "and", "with", "wala", "wali", "ka", "ki", "ke", "ko", "me", "mein",
  "to", "than", "less", "more", "max", "min", "upto", "up",
  // roman-urdu filler words ("mujhe phone chahiye")
  "mujhe", "mujhy", "mjhe", "mera", "meri", "mere", "hume", "humein", "chahiye", "chahiyay", "chahye", "chaiye",
  "chahie", "hai", "hain", "ho", "hon", "par", "pe", "wale", "aur", "koi", "kuch", "ek", "aik", "jo",
  "dikhao", "dikha", "batao", "bata", "do", "dena", "de", "dijiye", "karo", "kar", "lena", "lo", "dhoondo", "dhundo",
  "want", "need", "looking", "find", "show", "buy", "best", "please", "plz", "pls", "i", "my", "me",
]);

const stem = (w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const wordsOf = (s) => (s ? s.split(" ").filter(Boolean) : []);

// "airpods, handsfree; ear buds\n#wireless" -> ["airpods","handsfree","ear buds","wireless"]
function splitTags(v) {
  return []
    .concat(v == null ? [] : v)
    .flatMap((x) => String(x ?? "").split(/[,;|\n#،]+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildLocalIndex(list, categories) {
  const catMap = new Map();
  (categories || []).forEach((c) => {
    if (c && c.name) {
      catMap.set(String(c.id), c.name);
      catMap.set(norm(c.name), c.name);
    }
  });

  const out = (Array.isArray(list) ? list : []).map((p) => {
    const catVals = [p.category, p.categoryId, p.categoryName, p.subcategory, p.subCategory, p.type]
      .concat(Array.isArray(p.categories) ? p.categories : [])
      .filter(Boolean)
      .map((v) => (typeof v === "object" ? v.name || v.id : catMap.get(String(v)) || v));

    const name = norm(p.name || p.title);
    const tagList = splitTags([p.tags, p.keywords]); // original text (for suggestions)
    const tagPhrases = uniq(tagList.map(norm));
    const tags = tagPhrases.join(" ");
    const brand = norm(p.brand);
    const cat = norm(catVals.join(" "));
    const extra = norm(
      [p.sku, Array.isArray(p.colors) ? p.colors.join(" ") : p.colors, p.variants, p.condition]
        .filter(Boolean)
        .join(" ")
    );
    const desc = norm(p.description || p.desc || p.details);
    const price = Number(getPrice(p)) || 0;

    const nameWords = wordsOf(name);
    const tagWords = wordsOf(tags);
    const brandWords = wordsOf(brand);
    const catWords = wordsOf(cat);
    const extraWords = wordsOf(extra);

    const stockNum = Number(p.stock);
    const inStock = !(p.stock != null && p.stock !== "" && Number.isFinite(stockNum) && stockNum <= 0);
    const sold = Number(p.soldCount) || 0;
    const ratingCount = Number(p.ratingCount) || 0;
    const rating = Number(p.ratingAvg) || 0;
    const pop = Math.min(3, Math.log10(1 + sold)) + (ratingCount > 0 ? (Math.min(rating, 5) / 5) * 1.5 : 0);

    return {
      p,
      name,
      cat,
      desc,
      price,
      tagList,
      tagPhrases,
      nameWords,
      tagWords,
      brandWords,
      catWords,
      extraWords,
      words: uniq([...nameWords, ...tagWords, ...brandWords, ...catWords, ...extraWords]),
      // "t shirt" / "ear buds" without spaces, so "tshirt" / "earbuds" still match
      compact: [name, ...tagPhrases, brand].join("|").replace(/ /g, ""),
      inStock,
      pop,
    };
  });

  out.sugg = buildSuggestions(out, categories);
  return out;
}

function parseQuery(query) {
  let s = " " + norm(String(query).replace(/(\d),(?=\d{3})/g, "$1")) + " ";
  let min = null;
  let max = null;
  let sort = null;
  const take = (re, fn) => {
    const m = s.match(re);
    if (m) {
      fn(m);
      s = s.replace(re, " ");
    }
  };

  take(/\s(\d+)\s+(?:to|se|and)\s+(\d+)\s/, (m) => {
    min = Math.min(+m[1], +m[2]);
    max = Math.max(+m[1], +m[2]);
  });
  take(/\s(?:under|below|less than|upto|up to|max|within|neeche|kam)\s+(?:rs\s+|pkr\s+)?(\d+)\s/, (m) => { max = +m[1]; });
  take(/\s(\d+)\s+(?:tak|se kam|se neeche|ke andar)\s/, (m) => { max = +m[1]; });
  take(/\s(?:above|over|more than|min|atleast|at least)\s+(?:rs\s+|pkr\s+)?(\d+)\s/, (m) => { min = +m[1]; });
  take(/\s(\d+)\s+(?:se zyada|se ziada|se upar|plus)\s/, (m) => { min = +m[1]; });
  take(/\s(?:price|rs|pkr)\s+(\d+)\s/, (m) => { if (max === null) max = +m[1]; });
  take(/\s(?:cheapest|sasta|sasti|cheap|lowest price|low price)\s/, () => { sort = "asc"; });
  take(/\s(?:expensive|mehnga|mehngi|costly|highest price)\s/, () => { sort = "desc"; });

  const tokens = s.split(" ").filter((t) => t && !STOP.has(t));
  return { tokens, min, max, sort };
}

function lev(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// best score of token `t` against one field's words:
// exact word / plural = ex, word STARTS with t = pre, t inside a word = sub
function wordScore(words, t, ex, pre, sub) {
  const ts = stem(t);
  let best = 0;
  for (const w of words) {
    if (w === t || stem(w) === ts) return ex;
    if (t.length >= 2 && w.startsWith(t)) best = Math.max(best, pre);
    else if (t.length >= 3 && w.includes(t)) best = Math.max(best, sub);
  }
  return best;
}

function tokenScore(e, t) {
  let s = wordScore(e.nameWords, t, 12, 10, 6);
  s = Math.max(s, wordScore(e.tagWords, t, 11, 9, 5)); // seller's Tags / Keywords
  s = Math.max(s, wordScore(e.brandWords, t, 9, 7, 4));
  s = Math.max(s, wordScore(e.catWords, t, 7, 6, 4));
  s = Math.max(s, wordScore(e.extraWords, t, 5, 4, 3));
  if (!s && t.length >= 4 && e.compact.includes(t)) s = 5; // "tshirt" vs "t shirt"
  if (!s && t.length >= 3 && (" " + e.desc).includes(" " + t)) s = 2;
  return s;
}

function fuzzyScore(e, t) {
  if (t.length < 4) return 0;
  const lim = t.length >= 7 ? 2 : 1;
  for (const w of e.words) {
    if (w.length >= 3 && Math.abs(w.length - t.length) <= lim && lev(t, w) <= lim) return 4;
  }
  return 0;
}

// whole-phrase bonuses: a seller keyword that equals / contains what the
// shopper typed should beat a random word match in the description.
function phraseBonus(e, tokens, phrase) {
  let b = 0;
  if (tokens.length > 1 && e.name.includes(phrase)) b += 10;
  if (e.name.startsWith(phrase)) b += 4;
  if (e.name === phrase) b += 6;
  let tagHit = 0;
  for (const tp of e.tagPhrases) {
    if (tp === phrase) { tagHit = Math.max(tagHit, 14); continue; }
    if (tp.includes(phrase)) { tagHit = Math.max(tagHit, 8); continue; }
    if (tokens.length > 1 && tokens.every((t) => tp.includes(t) || tp.includes(stem(t)))) tagHit = Math.max(tagHit, 6);
  }
  return b + tagHit;
}

const rs = (n) => "Rs " + Number(n).toLocaleString("en-PK");

function localSearch(index, query) {
  const { tokens, min, max, sort } = parseQuery(query);
  const phrase = tokens.join(" ");
  let note = "";
  let scored;

  if (tokens.length === 0) {
    scored = index.map((e) => ({ e, s: 0 }));
  } else {
    const rows = [];
    for (const e of index) {
      let total = 0;
      let matched = 0;
      let fuzzy = false;
      for (const t of tokens) {
        let s = tokenScore(e, t);
        if (!s) {
          s = fuzzyScore(e, t); // typo tolerance on every word
          if (s) fuzzy = true;
        }
        if (s) { total += s; matched++; }
      }
      if (matched) rows.push({ e, s: total, matched, fuzzy });
    }

    let full = rows.filter((r) => r.matched === tokens.length);
    const exactOnly = full.filter((r) => !r.fuzzy);
    if (exactOnly.length) full = exactOnly; // typo matches only when nothing matches exactly
    if (full.length) {
      scored = full;
      if (full.every((r) => r.fuzzy)) note = "Showing similar results (spelling matched loosely).";
    } else {
      // not every word matched anywhere -> closest results (most words first)
      scored = rows.map((r) => ({ ...r, s: r.s + r.matched * 6 }));
      if (scored.length) note = "No exact match — showing closest results.";
    }
    scored.forEach((r) => { r.s += phraseBonus(r.e, tokens, phrase); });
  }

  if (min !== null) scored = scored.filter((x) => x.e.price >= min);
  if (max !== null) scored = scored.filter((x) => x.e.price <= max);

  // in-stock and popular products first (Amazon / Daraz style)
  scored.forEach((x) => { x.s += x.e.pop - (x.e.inStock ? 0 : 6); });

  if (sort === "asc") scored.sort((a, b) => a.e.price - b.e.price);
  else if (sort === "desc") scored.sort((a, b) => b.e.price - a.e.price);
  else scored.sort((a, b) => b.s - a.s);

  const chips = [];
  if (min !== null && max !== null) chips.push({ kind: "price", label: `${rs(min)} – ${rs(max)}` });
  else if (max !== null) chips.push({ kind: "price", label: `Under ${rs(max)}` });
  else if (min !== null) chips.push({ kind: "price", label: `Above ${rs(min)}` });
  if (sort) chips.push({ kind: "sort", label: sort === "asc" ? "Cheapest first" : "Most expensive first" });

  return { products: scored.map((x) => x.e.p), chips, note };
}

/* ------------------------------------------------------------------
   SEARCH SUGGESTIONS (dropdown while typing): product names, seller
   keywords, brands and categories that start with what was typed.
------------------------------------------------------------------ */

function buildSuggestions(entries, categories) {
  const seen = new Map();
  const add = (label, type) => {
    const text = String(label || "").trim();
    if (!text || text.length > 80) return;
    const key = norm(text);
    if (!key || key.length < 2) return;
    const cur = seen.get(key);
    if (cur) { cur.w += 1; return; }
    seen.set(key, { label: text, key, words: key.split(" "), type, w: 1 });
  };
  entries.forEach((e) => {
    add(e.p.name || e.p.title, "product");
    e.tagList.forEach((t) => add(t, "keyword"));
    add(e.p.brand, "brand");
  });
  (categories || []).forEach((c) => add(c && c.name, "category"));
  return Array.from(seen.values());
}

function getSuggestions(sugg, q, limit = 8) {
  const nq = norm(q);
  if (!nq || !Array.isArray(sugg)) return [];
  const qt = nq.split(" ");
  const out = [];
  for (const s of sugg) {
    if (s.key === nq) continue;
    let r = 0;
    if (s.key.startsWith(nq)) r = 3;
    else if (qt.every((t) => s.words.some((w) => w.startsWith(t)))) r = 2;
    else if (nq.length >= 3 && s.key.includes(nq)) r = 1;
    if (r) out.push({ ...s, r });
  }
  out.sort((a, b) => b.r - a.r || b.w - a.w || a.label.length - b.label.length);
  return out.slice(0, limit);
}

const SUGG_TYPE_LABEL = { product: "", keyword: "", brand: "Brand", category: "Category" };

/* ------------------------------------------------------------------ */

export default function SmartSearch({ loadProducts, categories, onResults, onClear, active }) {
  const [q, setQ] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState(readRecent);
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en-US");
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [idxReady, setIdxReady] = useState(0);

  const localRef = useRef(null);
  const libRef = useRef(null);
  const reqRef = useRef(0);
  const recRef = useRef(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const prevActiveRef = useRef(!!active);

  const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  async function getLocalIndex() {
    const list = await loadProducts();
    const cur = localRef.current;
    if (cur && cur.src === list && cur.cats === categories) return cur.idx;
    const idx = buildLocalIndex(list, categories);
    localRef.current = { src: list, cats: categories, idx };
    return idx;
  }

  async function getLibIndex() {
    const list = await loadProducts();
    const cur = libRef.current;
    if (cur && cur.src === list && cur.cats === categories) return cur.idx;
    const idx = buildIndex(list, categories);
    libRef.current = { src: list, cats: categories, idx };
    return idx;
  }

  function remember(query) {
    const next = [query, ...recent.filter((x) => x.toLowerCase() !== query.toLowerCase())].slice(0, 6);
    setRecent(next);
    writeRecent(next);
  }

  async function doSearch(text, { ai = false, save = false, live = false } = {}) {
    const query = String(text || "").trim();
    if (!query) return;
    if (!live) setFocused(false);
    setBusy(true);
    const id = ++reqRef.current;
    try {
      if (ai) {
        const idx = await getLibIndex();
        const r = await aiParse(query, categories);
        const res = runSearch(idx, r.filters);
        if (id !== reqRef.current) return;
        onResults({
          query,
          mode: "ai",
          aiUsed: r.aiUsed,
          aiFallback: !r.aiUsed,
          summary: r.summary,
          note: res.note,
          chips: chipsFor(r.filters),
          products: res.products,
        });
      } else {
        const idx = await getLocalIndex();
        const r = localSearch(idx, query);
        if (id !== reqRef.current) return;
        onResults({
          query,
          mode: "basic",
          aiUsed: false,
          aiFallback: false,
          summary: "",
          note: r.note,
          chips: r.chips,
          products: r.products,
        });
      }
      if (save) remember(query);
    } catch (e) {
      if (id === reqRef.current) onResults({ query, mode: "basic", error: e?.message || "Search failed", products: [], chips: [] });
    } finally {
      if (id === reqRef.current) setBusy(false);
    }
  }

  // live results while typing (normal mode)
  useEffect(() => {
    if (aiMode || listening) return;
    const t = q.trim();
    if (t.length < 2) {
      if (active) onClear();
      return;
    }
    const h = setTimeout(() => doSearch(t, { live: true }), LIVE_DELAY);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, aiMode, listening]);

  // suggestions dropdown while typing (normal mode)
  useEffect(() => {
    const t = q.trim();
    if (!focused || aiMode || listening || t.length < 1) {
      setSuggestions([]);
      return;
    }
    const idx = localRef.current && localRef.current.idx;
    setSuggestions(idx ? getSuggestions(idx.sugg, t) : []);
    setActiveIdx(-1);
  }, [q, focused, aiMode, listening, idxReady]);

  // "Back to Home" from the results page -> clear the box
  useEffect(() => {
    if (prevActiveRef.current && !active) {
      reqRef.current++;
      setQ("");
      setBusy(false);
    }
    prevActiveRef.current = !!active;
  }, [active]);

  // close recent-searches dropdown on outside tap
  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* ignore */ } }, []);

  function clearAll() {
    reqRef.current++;
    setQ("");
    setAiMode(false);
    setBusy(false);
    onClear();
    inputRef.current?.focus();
  }

  function pickSuggestion(label) {
    setQ(label);
    setSuggestions([]);
    setFocused(false);
    doSearch(label, { save: true });
    inputRef.current?.blur();
  }

  function toggleVoice() {
    if (!SR) return;
    if (listening) {
      try { recRef.current?.stop(); } catch { /* ignore */ }
      return;
    }
    const rec = new SR();
    rec.lang = voiceLang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = "";
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setQ(t);
      if (e.results[e.results.length - 1].isFinal) finalText = t;
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) { setAiMode(true); doSearch(finalText, { ai: true, save: true }); }
    };
    recRef.current = rec;
    setListening(true);
    setFocused(false);
    try { rec.start(); } catch { setListening(false); }
  }

  const showRecent = focused && !busy && q.trim() === "" && recent.length > 0;
  const showSuggestions = focused && !aiMode && !listening && q.trim() !== "" && suggestions.length > 0;

  // hard reset so global button/input CSS can't break the layout
  const reset = {
    margin: 0, padding: 0, border: "none", outline: "none", boxShadow: "none", background: "transparent",
    minWidth: 0, minHeight: 0, borderRadius: 0, appearance: "none", WebkitAppearance: "none",
  };
  const smallBtn = {
    ...reset, cursor: "pointer", width: 32, height: 32, flex: "0 0 32px", borderRadius: 999,
    display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1,
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 2, width: "100%", height: 46, boxSizing: "border-box",
          background: "#fff", borderRadius: 999, padding: "0 4px 0 14px",
          border: aiMode ? "2px solid #7c3aed" : "1.5px solid var(--teal)",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={q}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search products"
          placeholder={listening ? "Listening… speak now" : "Search in Trelqo"}
          onChange={(e) => { if (aiMode) setAiMode(false); setQ(e.target.value); }}
          onFocus={() => { setFocused(true); loadProducts().then(() => getLocalIndex()).then(() => setIdxReady((n) => n + 1)).catch(() => {}); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && suggestions.length) { e.preventDefault(); setActiveIdx((i) => (i + 1) % suggestions.length); return; }
            if (e.key === "ArrowUp" && suggestions.length) { e.preventDefault(); setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); return; }
            if (e.key === "Enter") {
              e.preventDefault();
              if (activeIdx >= 0 && suggestions[activeIdx]) { pickSuggestion(suggestions[activeIdx].label); return; }
              doSearch(q, { ai: aiMode, save: true });
              e.currentTarget.blur();
            }
            if (e.key === "Escape") setFocused(false);
          }}
          style={{ ...reset, flex: "1 1 0", width: "auto", height: "100%", fontSize: 16, color: "inherit" }}
        />

        {(q || active) && (
          <button type="button" onClick={clearAll} aria-label="Clear search" style={{ ...smallBtn, color: "var(--ink-soft)" }}>✕</button>
        )}

        {SR && (
          <>
            <button
              type="button"
              onClick={() => setVoiceLang((l) => (l === "en-US" ? "ur-PK" : "en-US"))}
              aria-label="Voice language"
              style={{ ...smallBtn, width: "auto", flex: "0 0 auto", padding: "0 7px", height: 26, fontSize: 11, fontWeight: 800, border: "1.5px solid var(--line)" }}
            >
              {voiceLang === "en-US" ? "EN" : "اردو"}
            </button>
            <button
              type="button" onClick={toggleVoice} aria-label={listening ? "Stop voice search" : "Voice search"}
              style={{ ...smallBtn, background: listening ? "#fee2e2" : "transparent" }}
            >
              🎤
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => doSearch(q, { ai: aiMode, save: true })}
          disabled={busy || !q.trim()}
          aria-label="Search"
          style={{
            ...reset, width: 38, height: 38, flex: "0 0 38px", borderRadius: 999, background: "var(--teal)", color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            cursor: busy || !q.trim() ? "default" : "pointer", opacity: !q.trim() ? 0.65 : 1,
          }}
        >
          {busy ? (
            <span style={{ fontWeight: 800 }}>…</span>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          )}
        </button>
      </div>

      {aiMode && busy && (
        <p style={{ fontSize: 13, marginTop: 8, color: "#7c3aed", fontWeight: 700 }}>✨ Understanding your request…</p>
      )}

      {showSuggestions && (
        <div
          className="card"
          role="listbox"
          style={{
            position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 30, background: "#fff",
            borderRadius: 14, padding: 6, maxHeight: "50vh", overflowY: "auto", boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
          }}
        >
          {suggestions.map((sg, i) => {
            const typed = q.trim();
            const starts = sg.label.toLowerCase().startsWith(typed.toLowerCase());
            return (
              <button
                key={sg.key}
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pickSuggestion(sg.label)}
                style={{
                  ...reset, display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                  padding: "0 10px", minHeight: 44, cursor: "pointer", fontSize: 14, borderRadius: 10,
                  background: i === activeIdx ? "#f1f5f4" : "transparent",
                }}
              >
                <span aria-hidden="true" style={{ opacity: 0.55, flex: "0 0 auto" }}>🔍</span>
                <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {starts ? (
                    <>
                      <strong>{sg.label.slice(0, typed.length)}</strong>
                      {sg.label.slice(typed.length)}
                    </>
                  ) : (
                    sg.label
                  )}
                </span>
                {SUGG_TYPE_LABEL[sg.type] && (
                  <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)" }}>{SUGG_TYPE_LABEL[sg.type]}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showRecent && (
        <div
          className="card"
          style={{
            position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 30, background: "#fff",
            borderRadius: 14, padding: 8, maxHeight: "50vh", overflowY: "auto", boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", textTransform: "uppercase" }}>Recent searches</span>
            <button
              type="button" onClick={() => { setRecent([]); writeRecent([]); }}
              style={{ ...reset, cursor: "pointer", fontSize: 12, color: "var(--danger)", fontWeight: 700 }}
            >
              Clear
            </button>
          </div>
          {recent.map((r) => (
            <button
              key={r} type="button" onClick={() => { setQ(r); doSearch(r, { save: true }); }}
              style={{ ...reset, display: "block", width: "100%", textAlign: "left", padding: "10px 8px", cursor: "pointer", fontSize: 14, borderRadius: 8 }}
            >
              🕘 {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}