import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listProducts, peekProducts } from "../lib/products";
import { listCategories, peekCategories } from "../lib/categories";
import ProductCard from "../components/ProductCard";

export default function CategoryPage() {
  const { id } = useParams();
  // Paint straight from the shared cached catalog when we already have it,
  // so switching categories feels instant instead of flashing skeletons.
  const [products, setProducts] = useState(() => peekProducts({ category: id, max: 200 }) || []);
  const [categories, setCategories] = useState(
    () => peekCategories()?.filter((c) => c.active) || []
  );
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(() => !peekProducts({ category: id, max: 200 }));

  useEffect(() => {
    const cachedForId = peekProducts({ category: id, max: 200 });
    if (cachedForId) {
      setProducts(cachedForId);
      setLoading(false);
    } else {
      setLoading(true);
    }
    listProducts({ category: id, max: 200 })
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [id]);

  // Load all active categories once so we can show them as a switchable bar
  // at the top of the page (independent of the products loading state).
  useEffect(() => {
    listCategories()
      .then((cats) => setCategories(cats.filter((c) => c.active)))
      .catch(() => {});
  }, []);

  const sorted = [...products].sort((a, b) => {
    const priceA = a.salePrice || a.price, priceB = b.salePrice || b.price;
    if (sort === "price_asc") return priceA - priceB;
    if (sort === "price_desc") return priceB - priceA;
    return 0;
  });

  const currentCategory = categories.find((c) => c.id === id);

  return (
    <div className="container" style={{ padding: "32px 20px" }}>
      {categories.length > 0 && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10, marginBottom: 20 }}>
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/category/${c.id}`}
              className="card"
              style={{
                minWidth: 110,
                flexShrink: 0,
                textAlign: "center",
                padding: "10px 16px",
                fontWeight: 700,
                fontSize: 13.5,
                border: c.id === id ? "1.5px solid var(--teal)" : "1px solid var(--line)",
                color: c.id === id ? "var(--teal)" : "var(--ink)",
                background: c.id === id ? "#ecf7f3" : "var(--surface)",
              }}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24 }}>{currentCategory?.name || "Category"}</h1>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--line)" }}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>
      {loading && <div className="grid-products">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: "3/4" }} />)}</div>}
      {!loading && sorted.length === 0 && <div className="empty-state">No products found in this category.</div>}
      <div className="grid-products">{sorted.map((p) => <ProductCard key={p.id} product={p} />)}</div>
    </div>
  );
}