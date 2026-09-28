import { useMemo, useState } from "react";
import ProductResults from "./ProductResults";
import { getPrice, getTs, formatRs } from "../lib/smartSearch";

const QUICK_RANGES = [
  [0, 500],
  [500, 1000],
  [1000, 2500],
  [2500, 5000],
  [5000, 10000],
  [10000, null],
];

const fieldStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid var(--line)",
  fontSize: 16, minWidth: 0, background: "#fff", boxSizing: "border-box",
};
const labelStyle = { fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 4, textTransform: "uppercase" };

export default function PriceRangePanel({ products }) {
  const priced = useMemo(
    () =>
      (products || [])
        .map((p, i) => ({ p, i, price: getPrice(p), ts: getTs(p) }))
        .filter((x) => Number.isFinite(x.price) && x.price >= 0),
    [products]
  );

  const bounds = useMemo(() => {
    if (priced.length === 0) return { lo: 0, hi: 0 };
    let lo = Infinity;
    let hi = 0;
    for (const x of priced) {
      if (x.price < lo) lo = x.price;
      if (x.price > hi) hi = x.price;
    }
    return { lo: Math.floor(lo), hi: Math.ceil(hi) };
  }, [priced]);

  const [minStr, setMinStr] = useState("");
  const [maxStr, setMaxStr] = useState("");
  const [sort, setSort] = useState("price_asc");

  const minVal = minStr === "" ? bounds.lo : Number(minStr);
  const maxVal = maxStr === "" ? bounds.hi : Number(maxStr);
  const lo = Math.min(minVal, maxVal); // if the user types them the wrong way round, just swap
  const hi = Math.max(minVal, maxVal);

  const results = useMemo(() => {
    const list = priced.filter((x) => x.price >= lo && x.price <= hi);
    if (sort === "price_asc") list.sort((a, b) => a.price - b.price || a.i - b.i);
    else if (sort === "price_desc") list.sort((a, b) => b.price - a.price || a.i - b.i);
    else list.sort((a, b) => b.ts - a.ts || a.i - b.i);
    return list.map((x) => x.p);
  }, [priced, lo, hi, sort]);

  const chips = useMemo(
    () =>
      QUICK_RANGES.map(([a, b]) => ({
        a,
        b,
        count: priced.filter((x) => x.price >= a && (b == null || x.price <= b)).length,
      })).filter((c) => c.count > 0),
    [priced]
  );

  if (!products) {
    return (
      <div className="grid-products">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: "5/1" }} />)}
      </div>
    );
  }
  if (priced.length === 0) return <div className="empty-state">No priced products yet.</div>;

  const span = bounds.hi - bounds.lo;
  const step = span > 50000 ? 500 : span > 10000 ? 100 : span > 2000 ? 50 : 10;
  const clamp = (v) => Math.min(bounds.hi, Math.max(bounds.lo, v));

  function onMinSlider(v) {
    setMinStr(String(v));
    if (v > maxVal) setMaxStr(String(v));
  }
  function onMaxSlider(v) {
    setMaxStr(String(v));
    if (v < minVal) setMinStr(String(v));
  }
  const digits = (s) => s.replace(/[^\d]/g, "").slice(0, 9);
  const isDefault = minStr === "" && maxStr === "";

  return (
    <section>
      <span className="section-eyebrow">Filter by price</span>
      <h2 style={{ fontSize: 22, marginBottom: 16 }}>Price range</h2>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: "1 1 130px", minWidth: 0 }}>
            <label style={labelStyle}>Min price (Rs)</label>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" placeholder={String(bounds.lo)}
              value={minStr} onChange={(e) => setMinStr(digits(e.target.value))} style={fieldStyle}
            />
          </div>
          <div style={{ flex: "1 1 130px", minWidth: 0 }}>
            <label style={labelStyle}>Max price (Rs)</label>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" placeholder={String(bounds.hi)}
              value={maxStr} onChange={(e) => setMaxStr(digits(e.target.value))} style={fieldStyle}
            />
          </div>
          <div style={{ flex: "1 1 160px", minWidth: 0 }}>
            <label style={labelStyle}>Sort by</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={fieldStyle}>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
        </div>

        {bounds.hi > bounds.lo && (
          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            <div>
              <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
                <span>Min</span><span>{formatRs(lo)}</span>
              </div>
              <input
                type="range" min={bounds.lo} max={bounds.hi} step={step} value={clamp(minVal)}
                onChange={(e) => onMinSlider(Number(e.target.value))}
                style={{ width: "100%", height: 32, accentColor: "var(--teal)" }} aria-label="Minimum price"
              />
            </div>
            <div>
              <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
                <span>Max</span><span>{formatRs(hi)}</span>
              </div>
              <input
                type="range" min={bounds.lo} max={bounds.hi} step={step} value={clamp(maxVal)}
                onChange={(e) => onMaxSlider(Number(e.target.value))}
                style={{ width: "100%", height: 32, accentColor: "var(--teal)" }} aria-label="Maximum price"
              />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {chips.map((c) => {
            const on = minStr !== "" && Number(minStr) === c.a && (c.b == null ? maxStr === "" : Number(maxStr) === c.b);
            return (
              <button
                key={`${c.a}-${c.b}`} type="button"
                onClick={() => { setMinStr(String(c.a)); setMaxStr(c.b == null ? "" : String(c.b)); }}
                style={{
                  padding: "8px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 36,
                  border: on ? "1.5px solid var(--teal)" : "1.5px solid var(--line)",
                  background: on ? "var(--teal)" : "#fff", color: on ? "#fff" : "inherit",
                }}
              >
                {c.b == null ? `${formatRs(c.a)}+` : `${formatRs(c.a)} – ${formatRs(c.b)}`} ({c.count})
              </button>
            );
          })}
          {!isDefault && (
            <button
              type="button" onClick={() => { setMinStr(""); setMaxStr(""); }}
              style={{ padding: "8px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 36, border: "1.5px solid var(--line)", background: "#fff", color: "var(--danger)" }}
            >
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 14 }}>
        <strong style={{ color: "inherit" }}>{results.length}</strong> product{results.length === 1 ? "" : "s"} between {formatRs(lo)} and {formatRs(hi)}
      </p>

      <ProductResults products={results} emptyText="No products in this price range. Try widening it." />
    </section>
  );
}