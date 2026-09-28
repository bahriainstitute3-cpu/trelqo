// src/lib/smartSearch.js
// Smart product search: typo tolerance, English + Urdu + Roman-Urdu words,
// price understanding ("4000 tak", "under 5k", "2000 se 5000"), ranking,
// and the client side of "Search with AI".
//
// Works 100% on the REAL products you pass in. The AI only *understands the
// sentence* (returns a JSON filter) - it never invents products.

// ---------------------------------------------------------------- helpers
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toAsciiDigits(s) {
  return String(s ?? "")
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
}

// lower-case, unify Urdu/Arabic letter variants, strip accents/punctuation
export function norm(s) {
  return toAsciiDigits(s)
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ةه]/g, "ہ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(/(\d)\.(\d)/g, "$1§$2")
    .replace(/[^\p{L}\p{N}\s§]/gu, " ")
    .replace(/§/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatRs(n) {
  const v = Number(n);
  return Number.isFinite(v) ? `Rs ${Math.round(v).toLocaleString()}` : "—";
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function stem(w) {
  return w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}

// ---------------------------------------------------------------- product data
export function getPrice(p) {
  const base = Number(p?.price ?? p?.unitPrice ?? p?.mrp);
  const cands = [p?.salePrice, p?.discountPrice, p?.discountedPrice, p?.finalPrice, p?.offerPrice]
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const sale = cands.find((n) => (Number.isFinite(base) ? n < base : true));
  if (sale != null) return sale;
  return Number.isFinite(base) ? base : NaN;
}

export function getTs(p) {
  const raw = p?.createdAt ?? p?.created_at ?? p?.addedAt ?? p?.date ?? p?.timestamp;
  if (!raw) return 0;
  try {
    if (typeof raw.toMillis === "function") return raw.toMillis();
    if (typeof raw.seconds === "number") return raw.seconds * 1000;
    if (typeof raw._seconds === "number") return raw._seconds * 1000;
    if (raw instanceof Date) return raw.getTime();
    const n = typeof raw === "number" ? raw : Date.parse(raw);
    if (!Number.isFinite(n)) return 0;
    return n < 1e12 ? n * 1000 : n;
  } catch {
    return 0;
  }
}

export function getThumb(p) {
  const first = Array.isArray(p?.images) ? p.images[0] : null;
  const v = first?.url || first || p?.image || p?.imageUrl || p?.thumbnail || "";
  return typeof v === "string" ? v : "";
}

// ---------------------------------------------------------------- vocabulary
const STOP = new Set(
  [
    // english
    "a", "an", "the", "i", "me", "my", "we", "you", "your", "want", "wants", "need", "needs", "looking", "look",
    "for", "find", "show", "give", "get", "buy", "please", "plz", "pls", "with", "without", "of", "in", "on", "at",
    "to", "from", "and", "or", "any", "some", "best", "good", "nice", "quality", "is", "are", "be", "it", "this",
    "that", "these", "those", "have", "has", "can", "could", "would", "should", "will", "like", "also", "just",
    "only", "very", "really", "one", "pieces", "piece", "products", "product", "item", "items", "something",
    "price", "rs", "pkr", "rupees", "rupee", "rupay", "rupaye", "cost", "costing", "around", "about", "approx",
    "approximately", "between", "range", "lagbhag", "qareeb", "kareeb", "ki", "ka", "ke",
    // roman urdu
    "mujhe", "mujhy", "mjhe", "mera", "meri", "mere", "hume", "humein", "chahiye", "chahiyay", "chahye", "chaiye",
    "chahie", "chahiya", "chaiyay", "chahyay", "hai", "hain", "ho", "hon", "hoga", "hogi", "ko", "se", "sy", "mai",
    "main", "me", "mein", "par", "pe", "wala", "wali", "wale", "aur", "koi", "kuch", "aisa", "aisi", "aise", "ek",
    "aik", "jo", "jisme", "jis", "isme", "usme", "uska", "uski", "uske", "iska", "iski", "iske", "kya", "kyun",
    "bhi", "hi", "to", "tou", "yeh", "ye", "woh", "wo", "dikhao", "dikha", "batao", "bata", "do", "dena", "de",
    "dijiye", "karo", "kar", "kijiye", "lena", "lo", "dhoondo", "dhundo", "talash", "zaroorat", "aap", "apka",
    "aapka", "under", "below", "above", "over", "upto", "within", "minimum", "maximum", "budget", "mil", "milega", "milegi", "sakta", "sakti", "tak", "kam", "zyada", "upar", "andar", "beech", "lekar",
    // urdu script
    "مجھے", "چاہیے", "چاہئے", "ہے", "ہو", "ہوں", "کا", "کی", "کے", "کو", "سے", "میں", "پر", "والا", "والی", "والے",
    "اور", "کوئی", "کچھ", "ایسا", "ایسی", "ایک", "جو", "جس", "کیا", "بھی", "ہی", "تو", "یہ", "وہ", "دکھاؤ",
    "بتاؤ", "دو", "دیں", "کریں", "قیمت", "روپے", "روپیہ", "تک", "کم", "زیادہ", "اوپر", "اندر", "ہیں",
  ].map(norm)
);

// each group = words that mean the same thing (English / Roman-Urdu / Urdu script)
const SYNONYM_GROUPS = [
  ["watch", "watches", "smart watch", "smartwatch", "wristwatch", "wrist watch", "ghari", "ghadi", "گھڑی"],
  ["phone", "mobile", "smartphone", "cellphone", "cell phone", "mobail", "فون", "موبائل"],
  ["headphone", "headphones", "earphone", "earphones", "earbuds", "earbud", "airpods", "handsfree", "hands free", "headset", "ہیڈفون"],
  ["charger", "adapter", "adaptor", "chargar"],
  ["cable", "wire", "data cable", "taar", "تار"],
  ["shoe", "shoes", "sneaker", "sneakers", "footwear", "joota", "joote", "jootay", "jute", "جوتا", "جوتے"],
  ["sandal", "sandals", "slipper", "slippers", "chappal", "chappals", "chapal", "khussa", "چپل", "کھسہ"],
  ["shirt", "shirts", "tshirt", "t shirt", "tee"],
  ["kurta", "kurti", "kameez", "qameez", "shalwar", "قمیض", "کرتا"],
  ["cap", "caps", "hat", "hats", "topi", "ٹوپی"],
  ["bag", "bags", "backpack", "handbag", "thaila", "bastah", "بیگ", "بستہ"],
  ["wallet", "batwa", "بٹوہ"],
  ["glasses", "sunglasses", "eyeglasses", "specs", "chashma", "aink", "عینک", "چشمہ"],
  ["perfume", "fragrance", "attar", "itar", "scent", "khushbu", "خوشبو", "عطر"],
  ["speaker", "speakers", "bluetooth speaker"],
  ["laptop", "notebook", "laptops"],
  ["power bank", "powerbank", "battery bank"],
  ["case", "cover", "back cover", "pouch"],
  ["toy", "toys", "khilona", "khilone", "کھلونا", "کھلونے"],
  ["kids", "kid", "child", "children", "bacha", "bache", "bachon", "baby", "بچے", "بچوں"],
  ["men", "mens", "man", "male", "gents", "mardana", "مردانہ"],
  ["women", "womens", "woman", "ladies", "lady", "female", "zanana", "خواتین", "زنانہ"],
  ["prayer mat", "janamaz", "jainamaz", "jai namaz", "jaye namaz", "musalla", "جائے نماز"],
  ["namaz", "prayer", "salah", "نماز"],
  ["tasbeeh", "tasbih", "rosary", "تسبیح"],
  ["touch", "touchscreen", "touch screen", "tach"],
  ["wireless", "bluetooth", "بلوٹوتھ"],
  ["waterproof", "water proof", "water resistant"],
  ["black", "kala", "kaala", "کالا", "کالی"],
  ["white", "safed", "سفید"],
  ["red", "surkh", "laal", "lal", "لال", "سرخ"],
  ["blue", "neela", "nila", "نیلا"],
  ["green", "hara", "sabz", "ہرا", "سبز"],
  ["gold", "golden", "sunehri", "سنہری"],
  ["silver", "chandi", "چاندی"],
  ["bedsheet", "bed sheet", "chadar", "chaddar", "bed cover", "چادر"],
  ["towel", "tauliya", "تولیہ"],
  ["shampoo", "conditioner"],
  ["cream", "lotion", "moisturizer", "moisturiser"],
];

const SYN_INDEX = new Map();
for (const grp of SYNONYM_GROUPS) {
  const nGrp = uniq(grp.map(norm));
  for (const w of nGrp) if (!SYN_INDEX.has(w)) SYN_INDEX.set(w, nGrp);
}

export function expandTerm(term) {
  const t = norm(term);
  if (!t) return [];
  const hit = SYN_INDEX.get(t) || SYN_INDEX.get(stem(t));
  return hit ? uniq([t, ...hit]) : [t];
}

// ---------------------------------------------------------------- price / intent parsing
const MULT = { k: 1e3, hazar: 1e3, hazaar: 1e3, hajar: 1e3, lakh: 1e5, lac: 1e5, lakhs: 1e5, sau: 100 };
const MULT_URDU = { "ہزار": 1e3, "لاکھ": 1e5, "سو": 100 };
const MULTS = { ...MULT, ...Object.fromEntries(Object.entries(MULT_URDU).map(([k, v]) => [norm(k), v])) };

const NUM_WORDS = Object.fromEntries(
  Object.entries({
    ek: 1, aik: 1, "ایک": 1, do: 2, "دو": 2, teen: 3, "تین": 3, char: 4, chaar: 4, "چار": 4, panch: 5, paanch: 5,
    "پانچ": 5, chhe: 6, chay: 6, che: 6, "چھ": 6, saat: 7, "سات": 7, aath: 8, "آٹھ": 8, nau: 9, "نو": 9, das: 10,
    "دس": 10, bees: 20, "بیس": 20, tees: 30, "تیس": 30, chalis: 40, "چالیس": 40, pachas: 50, "پچاس": 50,
    dhai: 2.5, derh: 1.5, "ڈیڑھ": 1.5, "ڈھائی": 2.5,
  }).map(([k, v]) => [norm(k), v])
);

const UNIT_WORDS = new Set([
  "gb", "mb", "tb", "mah", "inch", "inches", "mp", "w", "watt", "watts", "cm", "mm", "kg", "g", "ml", "l", "pcs",
  "pc", "pack", "set", "ghz", "hz", "v", "x", "pro", "ltr", "meter", "meters", "yard", "size", "no",
]);
const FILLER = new Set(["rs", "pkr", "rupees", "rupee", "rupay", "rupaye", "price", "of", "ka", "ki", "ke", "ho", "hai", "wala", "wali", "wale", "روپے", "قیمت"].map(norm));

const PHRASES = [
  ["kam se kam", "zzmin"], ["کم از کم", "zzmin"], ["at least", "zzmin"], ["atleast", "zzmin"], ["not less than", "zzmin"],
  ["no less than", "zzmin"], ["starting from", "zzmin"], ["more than", "zzmin"], ["greater than", "zzmin"],
  ["higher than", "zzmin"], ["costlier than", "zzmin"], ["se zyada", "zzmin"], ["sy zyada", "zzmin"],
  ["se ziada", "zzmin"], ["se upar", "zzmin"], ["se ooper", "zzmin"], ["سے زیادہ", "zzmin"], ["سے اوپر", "zzmin"],
  ["zyada se zyada", "zzmax"], ["زیادہ سے زیادہ", "zzmax"], ["at most", "zzmax"], ["less than", "zzmax"],
  ["lower than", "zzmax"], ["not more than", "zzmax"], ["no more than", "zzmax"], ["cheaper than", "zzmax"],
  ["up to", "zzmax"], ["se kam", "zzmax"], ["sy kam", "zzmax"], ["se kum", "zzmax"], ["se neechay", "zzmax"],
  ["se niche", "zzmax"], ["ke andar", "zzmax"], ["ke ander", "zzmax"], ["سے کم", "zzmax"], ["کے اندر", "zzmax"],
].map(([p, t]) => [norm(p), t]);

const MARK_WORDS = {
  under: "zzmax", below: "zzmax", upto: "zzmax", within: "zzmax", max: "zzmax", maximum: "zzmax", budget: "zzmax",
  tak: "zzmax", tk: "zzmax", takk: "zzmax", andar: "zzmax", ander: "zzmax", [norm("تک")]: "zzmax", [norm("اندر")]: "zzmax",
  over: "zzmin", above: "zzmin", minimum: "zzmin", min: "zzmin", upar: "zzmin", plus: "zzmin", [norm("اوپر")]: "zzmin",
};

const SORT_WORDS = [
  ["price_asc", ["sasta", "sasti", "saste", "cheap", "cheapest", "lowest", "affordable", "سستا", "سستی", "سستے"]],
  ["price_desc", ["mehnga", "mehngi", "mehnge", "expensive", "premium", "costly", "luxury", "مہنگا", "مہنگی"]],
  ["newest", ["latest", "newest", "naya", "nayi", "naye", "نیا", "نئی", "نئے"]],
].map(([k, ws]) => [k, ws.map(norm)]);

function convertNumbers(text) {
  let t = ` ${text} `;
  // 4k / 4 hazar / 1.5 lakh / 5 sau
  t = t.replace(/(\d+(?:\.\d+)?)\s*(k|hazar|hazaar|hajar|lakh|lac|lakhs|sau|ہزار|لاکھ|سو)(?=\s|$)(?!\s+(?:tv|led|uhd|camera|video|monitor|display|resolution|ultra|hd|screen)(?:\s|$))/g, (_, n, u) => {
    const m = MULTS[norm(u)] ?? MULTS[u];
    return ` ${Math.round(parseFloat(n) * m)} `;
  });
  // char hazar / paanch sau
  const words = Object.keys(NUM_WORDS).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const mults = Object.keys(MULTS).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(?:\\s)(${words})\\s+(${mults})(?=\\s)`, "g");
  t = t.replace(re, (_, w, u) => ` ${Math.round(NUM_WORDS[w] * MULTS[u])} `);
  return t.replace(/\s+/g, " ").trim();
}

function canonicalizeMarkers(text) {
  let t = ` ${text} `;
  for (const [phrase, tok] of PHRASES) {
    t = t.split(` ${phrase} `).join(` ${tok} `);
  }
  return t.replace(/\s+/g, " ").trim();
}

// returns { minPrice, maxPrice, approx, target, sort, rest: string[] (tokens not used for price) }
export function extractIntent(rawQuery) {
  let text = convertNumbers(norm(rawQuery));
  text = canonicalizeMarkers(text);
  const tokens = text.split(" ").filter(Boolean);
  const isNum = (t) => t != null && /^\d+(\.\d+)?$/.test(t);
  const used = new Array(tokens.length).fill(false);

  let minPrice = null;
  let maxPrice = null;
  let approx = false;
  let target = null;

  const priceCandidate = (i) => {
    if (!isNum(tokens[i])) return false;
    const v = parseFloat(tokens[i]);
    const nextTok = tokens[i + 1];
    if (nextTok && UNIT_WORDS.has(nextTok) && v < 100000) return false;
    const near = [tokens[i - 1], tokens[i + 1], tokens[i - 2], tokens[i + 2]];
    const hasMarker = near.some((x) => x && (FILLER.has(x) || x === "zzmin" || x === "zzmax" || MARK_WORDS[x]));
    return v >= 100 || (hasMarker && v >= 1);
  };

  // range: "2000 5000", "2000 se 5000", "2000 to 5000"
  const CONNECT = new Set(["to", "se", "sy", "and", "aur", "or", "lekar", "till", "until", "سے", "اور"].map(norm));
  for (let i = 0; i < tokens.length; i++) {
    if (!priceCandidate(i)) continue;
    let j = i + 1;
    if (tokens[j] && CONNECT.has(tokens[j])) j++;
    if (j < tokens.length && isNum(tokens[j]) && priceCandidate(j)) {
      const a = parseFloat(tokens[i]);
      const b = parseFloat(tokens[j]);
      minPrice = Math.min(a, b);
      maxPrice = Math.max(a, b);
      for (let k = i; k <= j; k++) used[k] = true;
      break;
    }
  }

  if (minPrice == null && maxPrice == null) {
    let count = 0;
    let lastVal = null;
    for (let i = 0; i < tokens.length; i++) {
      if (!priceCandidate(i)) continue;
      const v = parseFloat(tokens[i]);
      used[i] = true;
      count++;
      lastVal = v;
      // marker directly before/after (skipping fillers)
      let p = i - 1;
      while (p >= 0 && FILLER.has(tokens[p])) p--;
      let n = i + 1;
      while (n < tokens.length && FILLER.has(tokens[n])) n++;
      const before = tokens[p];
      const after = tokens[n];
      const isMax = before === "zzmax" || after === "zzmax" || MARK_WORDS[before] === "zzmax" || MARK_WORDS[after] === "zzmax";
      const isMin = before === "zzmin" || after === "zzmin" || MARK_WORDS[before] === "zzmin" || MARK_WORDS[after] === "zzmin";
      if (isMax && !isMin) maxPrice = v;
      else if (isMin && !isMax) minPrice = v;
      else if (isMin && isMax) { maxPrice = v; }
    }
    if (count === 1 && minPrice == null && maxPrice == null && lastVal != null) {
      approx = true;
      target = lastVal;
      minPrice = Math.round(lastVal * 0.7);
      maxPrice = Math.round(lastVal * 1.3);
    }
  }

  // sorting words
  let sort = "relevance";
  tokens.forEach((t, i) => {
    for (const [key, ws] of SORT_WORDS) {
      if (ws.includes(t)) { sort = key; used[i] = true; }
    }
  });

  // words left over = the actual product terms
  const rest = tokens.filter((t, i) => {
    if (used[i] || t === "zzmin" || t === "zzmax") return false;
    if (MARK_WORDS[t]) {
      // "under/tak/max/..." only counts as a price marker when it sits next to a price
      let l = i - 1;
      while (l >= 0 && FILLER.has(tokens[l])) l--;
      let r = i + 1;
      while (r < tokens.length && FILLER.has(tokens[r])) r++;
      if ((l >= 0 && used[l]) || (r < tokens.length && used[r])) return false;
    }
    return true;
  });
  return { minPrice, maxPrice, approx, target, sort, rest };
}

// Build filters from plain text (no AI)
export function parseQueryLocal(query) {
  const intent = extractIntent(query);
  const words = intent.rest.filter((t) => !STOP.has(t) && !FILLER.has(t) && t.length > 0);
  const groups = [];
  for (let i = 0; i < words.length; i++) {
    const bi = i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : null;
    if (bi && SYN_INDEX.has(bi)) {
      groups.push({ role: "core", label: bi, terms: expandTerm(bi) });
      i++;
    } else {
      groups.push({ role: "core", label: words[i], terms: expandTerm(words[i]) });
    }
  }
  return {
    groups,
    minPrice: intent.minPrice,
    maxPrice: intent.maxPrice,
    approx: intent.approx,
    target: intent.target,
    sort: intent.sort,
  };
}

// ---------------------------------------------------------------- index + matching
function makeField(str) {
  const text = norm(str);
  return { text, words: text ? text.split(" ") : [] };
}

const INDEX_CACHE = new WeakMap();

export function buildIndex(products, categories) {
  const list = Array.isArray(products) ? products : [];
  const cached = INDEX_CACHE.get(list);
  if (cached && cached.cats === categories) return cached.idx;

  const catMap = new Map((categories || []).map((c) => [String(c.id), c.name]));
  const idx = list.map((p, i) => {
    const catText = p.categoryName || catMap.get(String(p.categoryId ?? p.category)) || "";
    const tagText = [].concat(p.tags || [], p.keywords || [], p.brand || "", p.subcategory || "").join(" ");
    return {
      p,
      i,
      name: makeField(p.name || p.title || p.productName || ""),
      cat: makeField(catText),
      tags: makeField(tagText),
      desc: makeField(String(p.description || "").slice(0, 400)),
      price: getPrice(p),
      ts: getTs(p),
    };
  });
  INDEX_CACHE.set(list, { cats: categories, idx });
  return idx;
}

// FIXED — prefix/fuzzy matching used to trigger on very short terms (3
// characters), so a query for "man"/"mardana" (from the "men" synonym group)
// would prefix-match unrelated product names like "Mango" or "Mantle",
// polluting results with irrelevant products. Short terms now only match
// on exact or exact-stem equality; prefix/substring/typo-fuzzy matching is
// reserved for terms of 4+ characters, where it's actually meaningful.
function matchWord(term, w) {
  if (w === term) return 1;
  const ts = stem(term);
  const ws = stem(w);
  if (ts === ws) return 1;
  if (term.length < 4) return 0;
  if (w.startsWith(term)) return 0.9;
  if (ts.length >= 4 && ws.startsWith(ts)) return 0.9;
  if (w.includes(term)) return 0.6;
  if (w.length >= 4) {
    const max = term.length >= 8 ? 2 : 1;
    if (lev(ts, ws, max) <= max) return 0.7;
  }
  return 0;
}

function matchField(term, f) {
  if (!f.text) return 0;
  if (term.includes(" ")) {
    if (f.text.includes(term)) return 1;
    let min = 1;
    for (const part of term.split(" ")) {
      let best = 0;
      for (const w of f.words) {
        best = Math.max(best, matchWord(part, w));
        if (best === 1) break;
      }
      if (!best) return 0;
      min = Math.min(min, best);
    }
    return min * 0.9;
  }
  let best = 0;
  for (const w of f.words) {
    const m = matchWord(term, w);
    if (m > best) { best = m; if (m === 1) break; }
  }
  return best;
}

// Per-field weight: a hit in the product NAME matters most, then tags,
// then category, then description. Category is intentionally the
// *weakest* signal — it used to be enough on its own to satisfy an
// "every word must match" requirement (see execute()), which is why
// searches were effectively only matching by category.
function altScore(term, e) {
  return Math.max(
    matchField(term, e.name) * 6,
    matchField(term, e.tags) * 3.5,
    matchField(term, e.cat) * 2,
    matchField(term, e.desc) * 1.5
  );
}

function groupScore(g, e) {
  let best = 0;
  for (const t of g.terms) {
    const s = altScore(t, e);
    if (s > best) best = s;
  }
  return best >= 1 ? best : 0;
}

// ---------------------------------------------------------------- search
// FIXED — the old version required EVERY search word to match somewhere
// (name/tags/category/description) before a product could appear at all,
// and stopped as soon as any tier returned results. A product's CATEGORY
// text often contains every word of a query on its own (e.g. category
// "Kids Shoes" satisfies a "kids shoes" search by itself), so that tier
// was satisfied immediately and the search stopped there — real products
// that matched by NAME but not every single word never got a chance to
// show up. Now a product only needs to match at least one search word to
// qualify, products matching MORE words / matching by NAME score higher
// and sort to the top, and partial / "related" matches still show below
// them instead of being hidden entirely.
function execute(index, f, priceMode) {
  let lo = null;
  let hi = null;
  if (priceMode !== "off") {
    if (f.minPrice != null) lo = priceMode === "slack" ? f.minPrice * 0.5 : f.minPrice;
    if (f.maxPrice != null) hi = priceMode === "slack" ? f.maxPrice * 1.6 : f.maxPrice;
  }
  const coreG = f.groups.filter((g) => g.role !== "attr");
  const attrG = f.groups.filter((g) => g.role === "attr");
  const out = [];

  for (const e of index) {
    if (lo != null || hi != null) {
      if (!Number.isFinite(e.price)) continue;
      if (lo != null && e.price < lo) continue;
      if (hi != null && e.price > hi) continue;
    }

    let score = 0;
    let coreHit = 0;
    for (const g of coreG) {
      const s = groupScore(g, e);
      if (s > 0) { coreHit++; score += s * 2; }
    }
    // needs to relate to at least ONE search word — not all of them
    if (coreG.length > 0 && coreHit === 0) continue;
    // reward matching more of the words, so full matches rank above partial ones
    if (coreG.length > 0) score += (coreHit / coreG.length) * 5;

    let attrHit = 0;
    for (const g of attrG) {
      const s = groupScore(g, e);
      if (s > 0) { attrHit++; score += s; }
    }
    if (attrG.length > 0) score += (attrHit / attrG.length) * 2;

    if (f.approx && f.target && Number.isFinite(e.price)) {
      score += 3 * Math.max(0, 1 - Math.abs(e.price - f.target) / f.target);
    }
    out.push({ e, score, coreHit, coreTotal: coreG.length });
  }

  const byRel = (a, b) => b.score - a.score || b.e.ts - a.e.ts || a.e.i - b.e.i;
  if (f.sort === "price_asc") out.sort((a, b) => a.e.price - b.e.price || byRel(a, b));
  else if (f.sort === "price_desc") out.sort((a, b) => b.e.price - a.e.price || byRel(a, b));
  else if (f.sort === "newest") out.sort((a, b) => b.e.ts - a.e.ts || byRel(a, b));
  else out.sort(byRel);
  return out;
}

export function runSearch(index, filters) {
  const hasPrice = filters.minPrice != null || filters.maxPrice != null;

  let rows = execute(index, filters, "strict");
  let note = "";

  if (!rows.length && hasPrice) {
    rows = execute(index, filters, "slack");
    if (rows.length) note = "Nothing in exactly that price range — showing products with close prices.";
  }
  if (!rows.length && hasPrice) {
    rows = execute(index, filters, "off");
    if (rows.length) note = "Nothing matched that price — showing related products regardless of price.";
  }
  if (rows.length && !note && filters.groups.length > 1) {
    const fullMatches = rows.filter((r) => r.coreTotal === 0 || r.coreHit === r.coreTotal).length;
    if (fullMatches === 0) note = "No exact match for every word — showing the closest related products.";
  }

  return { products: rows.map((r) => r.e.p), note };
}

export function quickSuggest(index, q, limit = 6) {
  const f = parseQueryLocal(q);
  if (!f.groups.length) return [];
  return runSearch(index, f).products.slice(0, limit);
}

// ---------------------------------------------------------------- chips for the UI
export function chipsFor(f) {
  const chips = [];
  for (const g of f.groups) chips.push({ kind: g.role === "attr" ? "attr" : "term", label: g.label || g.terms[0] });
  if (f.approx && f.target) chips.push({ kind: "price", label: `≈ ${formatRs(f.target)}` });
  else if (f.minPrice != null && f.maxPrice != null) chips.push({ kind: "price", label: `${formatRs(f.minPrice)} – ${formatRs(f.maxPrice)}` });
  else if (f.maxPrice != null) chips.push({ kind: "price", label: `Under ${formatRs(f.maxPrice)}` });
  else if (f.minPrice != null) chips.push({ kind: "price", label: `Above ${formatRs(f.minPrice)}` });
  if (f.sort === "price_asc") chips.push({ kind: "sort", label: "Lowest price first" });
  if (f.sort === "price_desc") chips.push({ kind: "sort", label: "Highest price first" });
  if (f.sort === "newest") chips.push({ kind: "sort", label: "Newest first" });
  return chips;
}

// ---------------------------------------------------------------- AI (Netlify function)
const AI_ENDPOINT = "/.netlify/functions/ai-search";

function cleanList(arr, max = 12) {
  return uniq((Array.isArray(arr) ? arr : []).map((x) => norm(String(x))).filter((x) => x && x.length <= 40)).slice(0, max);
}
function expandAll(list) {
  return uniq(list.flatMap((t) => expandTerm(t)));
}
const numOrNull = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));

function mergeAi(data, local) {
  let groups = [];
  const core = cleanList(data.core);
  if (core.length) groups.push({ role: "core", label: core[0], terms: expandAll(core) });
  for (const a of Array.isArray(data.attributes) ? data.attributes : []) {
    const list = cleanList(Array.isArray(a) ? a : [a], 8);
    if (list.length) groups.push({ role: "attr", label: list[0], terms: expandAll(list) });
  }
  if (!groups.length) groups = local.groups;

  let minPrice = numOrNull(data.minPrice);
  let maxPrice = numOrNull(data.maxPrice);
  let approx = !!data.approx;
  let target = null;
  if (minPrice == null && maxPrice == null) {
    minPrice = local.minPrice;
    maxPrice = local.maxPrice;
    approx = local.approx;
    target = local.target;
  } else if (approx && minPrice != null && maxPrice != null) {
    target = Math.round((minPrice + maxPrice) / 2);
  } else {
    approx = false;
  }
  const sort = ["relevance", "price_asc", "price_desc", "newest"].includes(data.sort) ? data.sort : local.sort;
  return { groups, minPrice, maxPrice, approx, target, sort };
}

export async function aiParse(query, categories = []) {
  const local = parseQueryLocal(query);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        categories: (categories || []).map((c) => c?.name).filter(Boolean).slice(0, 60),
      }),
      signal: ctrl.signal,
    });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("application/json")) throw new Error("AI service not reachable");
    const data = await res.json();
    if (!data || data.error) throw new Error(data?.error || "AI error");
    return { filters: mergeAi(data, local), aiUsed: true, summary: data.summary || "" };
  } catch (e) {
    return { filters: local, aiUsed: false, summary: "", error: e?.message || "AI unavailable" };
  } finally {
    clearTimeout(timer);
  }
}