import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CustomSelect } from "../components/CustomSelect";
import { PageMeta } from "../components/PageMeta";
import { ProductCard } from "../components/ProductCard";
import { QuickView } from "../components/QuickView";
import { SectionHeading } from "../components/SectionHeading";
import { useCatalog } from "../context/CatalogContext";
import { type Product } from "../data/catalog";

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function ShopPage() {
  const [params] = useSearchParams();
  const { products, error } = useCatalog();
  const [category, setCategory] = useState(params.get("category") ?? "All");
  const [color, setColor] = useState("All");
  const [material, setMaterial] = useState("All");
  const [occasion, setOccasion] = useState("All");
  const [maxPrice, setMaxPrice] = useState(800);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const categoryOptions = useMemo(() => uniqueSorted(products.map((product) => product.category)), [products]);
  const colorOptions = useMemo(() => uniqueSorted(products.flatMap((product) => product.colors)), [products]);
  const materialOptions = useMemo(() => uniqueSorted(products.map((product) => product.material)), [products]);
  const occasionOptions = useMemo(() => uniqueSorted(products.flatMap((product) => product.occasion)), [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch = category === "All" || product.category === category;
      const colorMatch = color === "All" || product.colors.includes(color);
      const materialMatch = material === "All" || product.material === material;
      const occasionMatch = occasion === "All" || product.occasion.includes(occasion);
      return categoryMatch && colorMatch && materialMatch && occasionMatch && product.price <= maxPrice;
    });
  }, [category, color, material, occasion, maxPrice, products]);

  return (
    <div className="page">
      <PageMeta
        title="Shop Accessories"
        path="/shop"
        description="Shop SEKANAE jewelry, handbags, scarves, sunglasses, leather goods, gifts, and travel accessories for women in motion."
      />
      <section className="page-hero shop-hero">
        <div>
          <h1>Shop SEKANAE</h1>
          <p>
            Discover accessories and gifts for women in motion.
          </p>
        </div>
      </section>

      <section className="shop-layout section-pad">
        <aside className="filter-panel" aria-label="Product filters">
          <h2><SlidersHorizontal size={18} /> Filters</h2>
          <CustomSelect label="Category" value={category} onChange={setCategory} options={["All", ...categoryOptions]} />
          <CustomSelect label="Color" value={color} onChange={setColor} options={["All", ...colorOptions]} />
          <CustomSelect label="Material" value={material} onChange={setMaterial} options={["All", ...materialOptions]} />
          <CustomSelect label="Occasion" value={occasion} onChange={setOccasion} options={["All", ...occasionOptions]} />
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
          {error && <p className="api-status">{error}</p>}
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
