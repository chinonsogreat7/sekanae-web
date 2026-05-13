import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { QuickView } from "../components/QuickView";
import { SectionHeading } from "../components/SectionHeading";
import { categories, colors, materials, occasions, products, type Product } from "../data/catalog";

export function ShopPage() {
  const [params] = useSearchParams();
  const [category, setCategory] = useState(params.get("category") ?? "All");
  const [color, setColor] = useState("All");
  const [material, setMaterial] = useState("All");
  const [occasion, setOccasion] = useState("All");
  const [maxPrice, setMaxPrice] = useState(800);
  const [quickView, setQuickView] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch = category === "All" || product.category === category;
      const colorMatch = color === "All" || product.colors.includes(color);
      const materialMatch = material === "All" || product.material === material;
      const occasionMatch = occasion === "All" || product.occasion.includes(occasion);
      return categoryMatch && colorMatch && materialMatch && occasionMatch && product.price <= maxPrice;
    });
  }, [category, color, material, occasion, maxPrice]);

  return (
    <div className="page">
      <section className="page-hero shop-hero">
        <div>
          <h1>Shop SEKANAE</h1>
          <p>
            Discover jewelry, handbags, scarves, sunglasses, leather goods, gifts, and
            travel accessories for women in motion.
          </p>
        </div>
      </section>

      <section className="shop-layout section-pad">
        <aside className="filter-panel" aria-label="Product filters">
          <h2><SlidersHorizontal size={18} /> Filters</h2>
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>All</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Color
            <select value={color} onChange={(event) => setColor(event.target.value)}>
              <option>All</option>
              {colors.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Material
            <select value={material} onChange={(event) => setMaterial(event.target.value)}>
              <option>All</option>
              {materials.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Occasion
            <select value={occasion} onChange={(event) => setOccasion(event.target.value)}>
              <option>All</option>
              {occasions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Price up to ${maxPrice}
            <input
              type="range"
              min="120"
              max="800"
              step="20"
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
            />
          </label>
        </aside>
        <div>
          <SectionHeading
            title={`${filteredProducts.length} refined pieces`}
            copy="Use filters to shop by category, color, material, price, and occasion."
          />
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onQuickView={setQuickView} />
            ))}
          </div>
        </div>
      </section>
      <QuickView product={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
