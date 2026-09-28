import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchProducts } from "../lib/products";
import ProductCard from "../components/ProductCard";

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    searchProducts(q).then(setResults).finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="container" style={{ padding: "32px 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Search results for "{q}"</h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>{loading ? "Searching…" : `${results.length} product(s) found`}</p>
      {!loading && results.length === 0 && <div className="empty-state">No products match your search. Try a different term.</div>}
      <div className="grid-products">{results.map((p) => <ProductCard key={p.id} product={p} />)}</div>
    </div>
  );
}
