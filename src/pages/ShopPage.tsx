import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CustomSelect } from "../components/CustomSelect";
import { PageMeta } from "../components/PageMeta";
import { ProductCard } from "../components/ProductCard";
import { QuickView } from "../components/QuickView";
import { CatalogFeedback } from "../components/CatalogFeedback";
import { useCatalog } from "../context/CatalogContext";
import { useStore } from "../context/store-context";
import { type Product } from "../data/catalog";
import { formatMoney } from "../utils/money";

type SortOption = "new" | "featured" | "price-asc" | "price-desc" | "name";

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function ShopPage() {
  const [params, setParams] = useSearchParams();
  const { products, error, loading, retry } = useCatalog();
  const { currency, exchangeRates } = useStore();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const category = params.get("category") ?? "All";
  const setCategory = (value: string) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    if (value === "All") next.delete("category"); else next.set("category", value);
    return next;
  });
  const [color, setColor] = useState("All");
  const [material, setMaterial] = useState("All");
  const [occasion, setOccasion] = useState("All");
  const [query, setQuery] = useState("");
  const sort = (params.get("sort") ?? "featured") as SortOption;
  const setSort = (value: string) => setParams((previous) => { const next = new URLSearchParams(previous); next.set("sort", value); return next; });
  const [priceLimit, setPriceLimit] = useState<number | null>(null);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const categoryOptions = useMemo(() => uniqueSorted(products.map((product) => product.category)), [products]);
  const colorOptions = useMemo(() => uniqueSorted(products.flatMap((product) => product.colors)), [products]);
  const materialOptions = useMemo(() => uniqueSorted(products.map((product) => product.material)), [products]);
  const occasionOptions = useMemo(() => uniqueSorted(products.flatMap((product) => product.occasion)), [products]);
  const highestPrice = useMemo(() => Math.max(800, ...products.map((product) => Math.ceil(product.price / 20) * 20)), [products]);
  const maxPrice = priceLimit ?? highestPrice;
  const setMaxPrice = (value: number) => setPriceLimit(value >= highestPrice ? null : value);
  const activeFilters = [
    category !== "All" ? { label: category, clear: () => setCategory("All") } : null,
    color !== "All" ? { label: color, clear: () => setColor("All") } : null,
    material !== "All" ? { label: material, clear: () => setMaterial("All") } : null,
    occasion !== "All" ? { label: occasion, clear: () => setOccasion("All") } : null,
    query.trim() ? { label: `Search: ${query.trim()}`, clear: () => setQuery("") } : null,
    maxPrice < highestPrice ? { label: `Up to ${formatMoney(maxPrice, currency, exchangeRates)}`, clear: () => setMaxPrice(highestPrice) } : null,
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
      if (sort === "new") return Number(Boolean(right.isNew)) - Number(Boolean(left.isNew)) || left.name.localeCompare(right.name);
      return 0;
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
        <button className="secondary-button filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="shop-filters" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={18} />{filtersOpen ? "Hide filters" : "Filter & sort"}{activeFilters.length ? ` (${activeFilters.length})` : ""}</button>
        <aside id="shop-filters" className={`filter-panel ${filtersOpen ? "filters-open" : ""}`} aria-label="Product filters">
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
              { label: "New arrivals", value: "new" },
              { label: "Price: low to high", value: "price-asc" },
              { label: "Price: high to low", value: "price-desc" },
              { label: "Name", value: "name" },
            ]}
          />
          <label>
            Price up to {formatMoney(maxPrice, currency, exchangeRates)}
            <input
              type="range"
              min="0"
              max={highestPrice}
              step="20"
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
            />
          </label>
          <button className="filter-reset" type="button" onClick={clearFilters} disabled={!activeFilters.length && sort === "featured"}>
            Reset filters
          </button>
        </aside>
        <div className="shop-results">
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
          {!error && products.length > 0 && <div className="shop-results-heading">
            <h2>{category === "All" ? "The collection" : category}</h2>
            <p role="status" aria-live="polite">{filteredProducts.length} {filteredProducts.length === 1 ? "piece" : "pieces"}</p>
          </div>}
          <CatalogFeedback loading={loading} error={error} total={products.length} matches={filteredProducts.length} retry={retry} clearFilters={clearFilters} />
          {!error && filteredProducts.length > 0 && (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onQuickView={setQuickView} />
              ))}
            </div>
          )}
        </div>
      </section>
      <QuickView product={products.find((product) => product.id === quickView?.id) ?? null} onClose={() => setQuickView(null)} />
    </div>
  );
}
