import { useEffect, useRef, useState } from "react";
import { buildIndex, runSearch, aiParse, chipsFor, getPrice } from "../lib/smartSearch";

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
   LOCAL FAST SEARCH  (name + category + brand/tags + description)
------------------------------------------------------------------ */

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP = new Set([
  "under", "below", "above", "over", "price", "rs", "pkr", "tak", "se", "kam", "zyada", "ziada",
  "in", "for", "the", "a", "an", "of", "and", "with", "wala", "wali", "ka", "ki", "ke", "ko", "me", "mein",
  "to", "than", "less", "more", "max", "min", "upto", "up",
]);

function buildLocalIndex(list, categories) {
  const catMap = new Map();
  (categories || []).forEach((c) => {
    if (c && c.name) {
      catMap.set(String(c.id), c.name);
      catMap.set(norm(c.name), c.name);
    }
  });

  return (Array.isArray(list) ? list : []).map((p) => {
    const catVals = [p.category, p.categoryId, p.categoryName, p.subcategory, p.subCategory, p.type]
      .concat(Array.isArray(p.categories) ? p.categories : [])
      .filter(Boolean)
      .map((v) => (typeof v === "object" ? v.name || v.id : catMap.get(String(v)) || v));

    const name = norm(p.name || p.title);
    const cat = norm(catVals.join(" "));
    const extra = norm(
      [p.brand, Array.isArray(p.tags) ? p.tags.join(" ") : p.tags, p.sku, p.keywords]
        .filter(Boolean)
        .join(" ")
    );
    const desc = norm(p.description || p.desc || p.details);
    const price = Number(getPrice(p)) || 0;

    return {
      p,
      name,
      cat,
      extra,
      desc,
      price,
      words: (name + " " + cat + " " + extra).split(" ").filter(Boolean),
    };
  });
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

function tokenScore(e, t) {
  let s = 0;
  if (e.name.includes(t)) s = (" " + e.name).includes(" " + t) ? 12 : 8;
  if (e.cat.includes(t)) s = Math.max(s, (" " + e.cat).includes(" " + t) ? 7 : 5);
  if (e.extra.includes(t)) s = Math.max(s, 5);
  if (e.desc.includes(t)) s = Math.max(s, 2);
  return s;
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
    // 1) every word must match somewhere
    scored = [];
    for (const e of index) {
      let total = 0;
      let ok = true;
      for (const t of tokens) {
        const s = tokenScore(e, t);
        if (!s) { ok = false; break; }
        total += s;
      }
      if (ok) {
        if (tokens.length > 1 && e.name.includes(phrase)) total += 10;
        scored.push({ e, s: total });
      }
    }

    // 2) any word matches
    if (scored.length === 0 && tokens.length > 1) {
      for (const e of index) {
        let total = 0;
        for (const t of tokens) total += tokenScore(e, t);
        if (total) scored.push({ e, s: total });
      }
      if (scored.length) note = "No exact match — showing closest results.";
    }

    // 3) typo tolerance
    if (scored.length === 0) {
      for (const e of index) {
        let total = 0;
        let ok = true;
        for (const t of tokens) {
          if (t.length < 4) { if (!tokenScore(e, t)) { ok = false; break; } total += 2; continue; }
          const lim = t.length >= 7 ? 2 : 1;
          if (e.words.some((w) => Math.abs(w.length - t.length) <= lim && lev(t, w) <= lim)) total += 5;
          else if (tokenScore(e, t)) total += 2;
          else { ok = false; break; }
        }
        if (ok && total) scored.push({ e, s: total });
      }
      if (scored.length) note = "Showing similar results (spelling matched loosely).";
    }
  }

  if (min !== null) scored = scored.filter((x) => x.e.price >= min);
  if (max !== null) scored = scored.filter((x) => x.e.price <= max);

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

/* ------------------------------------------------------------------ */

export default function SmartSearch({ loadProducts, categories, onResults, onClear, active }) {
  const [q, setQ] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState(readRecent);
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en-US");

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

  async function doSearch(text, { ai = false, save = false } = {}) {
    const query = String(text || "").trim();
    if (!query) return;
    setFocused(false);
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
    const h = setTimeout(() => doSearch(t), LIVE_DELAY);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, aiMode, listening]);

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
          onFocus={() => { setFocused(true); loadProducts().then(() => getLocalIndex()).catch(() => {}); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); doSearch(q, { ai: aiMode, save: true }); e.currentTarget.blur(); }
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