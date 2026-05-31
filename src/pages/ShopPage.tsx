import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CustomSelect } from "../components/CustomSelect";
import { PageMeta } from "../components/PageMeta";
import { ProductCard } from "../components/ProductCard";
import { QuickView } from "../components/QuickView";
import { SectionHeading } from "../components/SectionHeading";
import { useCatalog } from "../context/CatalogContext";
import { type Product } from "../data/catalog";
import { formatMoney } from "../utils/money";

type SortOption = "featured" | "price-asc" | "price-desc" | "name";

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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("featured");
  const [maxPrice, setMaxPrice] = useState(800);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const categoryOptions = useMemo(() => uniqueSorted(products.map((product) => product.category)), [products]);
  const colorOptions = useMemo(() => uniqueSorted(products.flatMap((product) => product.colors)), [products]);
  const materialOptions = useMemo(() => uniqueSorted(products.map((product) => product.material)), [products]);
  const occasionOptions = useMemo(() => uniqueSorted(products.flatMap((product) => product.occasion)), [products]);
  const highestPrice = useMemo(() => Math.max(800, ...products.map((product) => Math.ceil(product.price / 20) * 20)), [products]);
  const activeFilters = [
    category !== "All" ? { label: category, clear: () => setCategory("All") } : null,
    color !== "All" ? { label: color, clear: () => setColor("All") } : null,
    material !== "All" ? { label: material, clear: () => setMaterial("All") } : null,
    occasion !== "All" ? { label: occasion, clear: () => setOccasion("All") } : null,
    query.trim() ? { label: `Search: ${query.trim()}`, clear: () => setQuery("") } : null,
    maxPrice < highestPrice ? { label: `Up to ${formatMoney(maxPrice, "EUR")}`, clear: () => setMaxPrice(highestPrice) } : null,
  ].filter((filter): filter is { label: string; clear: () => void } => Boolean(filter));

  const filteredProducts = useMemo(() => {
    const search = query.trim().toLowerCase();
    const results = products.filter((product) => {
      const categoryMatch = category === "All" || product.category === category;
      const colorMatch = color === "All" || product.colors.includes(color);
      const materialMatch = material === "All" || product.material === material;
      const occasionMatch = occasion === "All" || product.occasion.includes(occasion);
      const searchMatch = !search || [
        product.name,
        product.category,
        product.collection,
        product.material,
        product.description,
        product.colors.join(" "),
        product.occasion.join(" "),
        product.tags?.join(" ") ?? "",
      ].some((value) => value.toLowerCase().includes(search));

      return categoryMatch && colorMatch && materialMatch && occasionMatch && searchMatch && product.price <= maxPrice;
    });

    return [...results].sort((left, right) => {
      if (sort === "price-asc") return left.price - right.price || left.name.localeCompare(right.name);
      if (sort === "price-desc") return right.price - left.price || left.name.localeCompare(right.name);
      if (sort === "name") return left.name.localeCompare(right.name);
      return Number(Boolean(right.isNew)) - Number(Boolean(left.isNew)) || left.name.localeCompare(right.name);
    });
  }, [category, color, material, occasion, maxPrice, products, query, sort]);

  function clearFilters() {
    setCategory("All");
    setColor("All");
    setMaterial("All");
    setOccasion("All");
    setQuery("");
    setMaxPrice(highestPrice);
    setSort("featured");
  }

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
          <label className="filter-search">
            Search
            <span>
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search bags, silk, pearl..."
              />
            </span>
          </label>
          <CustomSelect label="Category" value={category} onChange={setCategory} options={["All", ...categoryOptions]} />
          <CustomSelect label="Color" value={color} onChange={setColor} options={["All", ...colorOptions]} />
          <CustomSelect label="Material" value={material} onChange={setMaterial} options={["All", ...materialOptions]} />
          <CustomSelect label="Occasion" value={occasion} onChange={setOccasion} options={["All", ...occasionOptions]} />
          <CustomSelect
            label="Sort"
            value={sort}
            onChange={(value) => setSort(value as SortOption)}
            options={[
              { label: "Featured", value: "featured" },
              { label: "Price: low to high", value: "price-asc" },
              { label: "Price: high to low", value: "price-desc" },
              { label: "Name", value: "name" },
            ]}
          />
          <label>
            Price up to {formatMoney(maxPrice, "EUR")}
            <input
              type="range"
              min="120"
              max={highestPrice}
              step="20"
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
            />
          </label>
          {activeFilters.length > 0 && (
            <div className="active-filter-list" aria-label="Active filters">
              {activeFilters.map((filter) => (
                <button key={filter.label} type="button" onClick={filter.clear}>
                  {filter.label}
                  <X size={13} />
                </button>
              ))}
            </div>
          )}
          <button className="filter-reset" type="button" onClick={clearFilters} disabled={!activeFilters.length && sort === "featured"}>
            Reset filters
          </button>
        </aside>
        <div>
          <SectionHeading
            title={`${filteredProducts.length} refined pieces`}
            copy="Use filters to shop by category, color, material, price, and occasion."
          />
          {error && <p className="api-status">{error}</p>}
          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onQuickView={setQuickView} />
              ))}
            </div>
          ) : (
            <div className="empty-state shop-empty-state">
              <h2>No pieces match</h2>
              <p>Clear a filter or search another material, color, or occasion.</p>
              <button className="primary-button" type="button" onClick={clearFilters}>Reset filters</button>
            </div>
          )}
        </div>
      </section>
      <QuickView product={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
