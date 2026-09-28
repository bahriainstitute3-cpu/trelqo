import { useEffect, useRef, useState } from "react";
import ProductCard from "./ProductCard";

// Same idea as the Home page: mount cards in batches while the user scrolls,
// so even 1000 matching products stay fast on a phone.
const PAGE_SIZE = 24;

export default function ProductResults({ products, emptyText = "No products found." }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  // new result set -> start from the first batch again
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [products]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || visible >= products.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible((c) => c + PAGE_SIZE);
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible, products.length]);

  if (products.length === 0) return <div className="empty-state">{emptyText}</div>;

  return (
    <>
      <div className="grid-products">
        {products.slice(0, visible).map((p, index) => (
          <ProductCard key={p.id} product={p} priority={index < 4} />
        ))}
      </div>
      {visible < products.length && <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />}
    </>
  );
}
