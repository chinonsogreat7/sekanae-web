import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CustomSelect } from "../components/CustomSelect";
import { PageMeta } from "../components/PageMeta";
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
          <CustomSelect label="Category" value={category} onChange={setCategory} options={["All", ...categories]} />
          <CustomSelect label="Color" value={color} onChange={setColor} options={["All", ...colors]} />
          <CustomSelect label="Material" value={material} onChange={setMaterial} options={["All", ...materials]} />
          <CustomSelect label="Occasion" value={occasion} onChange={setOccasion} options={["All", ...occasions]} />
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
