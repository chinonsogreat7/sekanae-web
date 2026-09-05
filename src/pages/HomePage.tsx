import { ArrowRight, MoveRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { PageMeta } from "../components/PageMeta";
import { SectionHeading } from "../components/SectionHeading";
import { collections } from "../data/catalog";
import { useCatalog } from "../context/CatalogContext";
import { journalPosts } from "../data/editorial";
import { CatalogFeedback } from "../components/CatalogFeedback";
import { ProductImage } from "../components/ProductImage";

export function HomePage() {
  const { products, error, loading, retry } = useCatalog();
  const featuredProduct = products.find((product) => product.category === "Jewelry") ?? products[0];
  const newArrivals = [...products].sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew))).slice(0, 5);
  const categories = ["Jewelry", "Handbags", "Scarves", "Travel Accessories", "Leather Goods"]
    .map((title) => ({ title, product: products.find((product) => product.category === title) }))
    .filter(({ product }) => Boolean(product));

  return (
    <div className="page boutique-home">
      <PageMeta
        title="SEKANAÉ | Luxury Accessories for Women of the World"
        path="/"
        description="SEKANAE is a refined accessories maison for modern international women, offering jewelry, handbags, scarves, travel accessories, gifts, and Bridal Atelier previews."
      />
      <section className={`hero-section${featuredProduct ? "" : " hero-text-only"}`}>
        <div className="hero-copy">
          <h1>Luxury Accessories for Women of the World</h1>
          <p>
            Timeless pieces crafted for elegance, movement, and modern international
            style.
          </p>
          <div className="hero-actions">
            <Link to="/shop?sort=new" className="primary-button">
              Shop New Arrivals
            </Link>
            <Link to="/collections" className="secondary-button">
              Explore the Collection
            </Link>
          </div>
        </div>
        {featuredProduct && <div className="hero-media" aria-label="SEKANAE luxury accessories editorial">
          <ProductImage
            images={featuredProduct.images}
            alt={featuredProduct.name}
            decoding="async"
            fetchPriority="high"
          />
        </div>}
      </section>

      {categories.length > 0 && <section className="section-pad" aria-label="Shop by category">
        <div className="category-grid boutique-category-grid">
          {categories.map(({ title, product }) => (
            <Link to={`/shop?category=${encodeURIComponent(title)}`} className="category-tile" key={title}>
              <ProductImage images={product!.images} alt={title} loading="lazy" />
              <span>{title}<MoveRight size={14} strokeWidth={1.4} aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      </section>}

      <section className="section-pad product-band">
        <SectionHeading
          title="New Arrivals"
        >
          <Link to="/shop?sort=new" className="text-link">
            View all <ArrowRight size={16} />
          </Link>
        </SectionHeading>
        <CatalogFeedback loading={loading} error={error} total={products.length} matches={newArrivals.length} retry={retry} />
        <div className="product-grid home-arrivals-grid">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="bridal-editorial-band">
        <img
          src="https://images.unsplash.com/photo-1529634597503-139d3726fed5?auto=format&fit=crop&w=1200&q=85"
          alt="Bridal atelier preview styling"
          decoding="async"
          loading="lazy"
        />
        <div>
          <h2>Bridal Atelier</h2>
          <p className="microcopy">Coming soon</p>
          <p>
            Elegant pieces for life's most meaningful moments.
          </p>
          <Link to="/bridal" className="secondary-button">
            Discover More
          </Link>
        </div>
      </section>

      <section className="section-pad journal-strip">
        <SectionHeading title="The Journal" copy="Stories on style, travel, and modern femininity." />
        <div className="journal-grid">
          {journalPosts.map((post) => (
            <article key={post.title}>
              <img src={post.image} alt={post.title} decoding="async" loading="lazy" />
              <p className="microcopy">{post.category}</p>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad mini-collections">
        {collections.slice(0, 3).map((collection) => (
          <Link to="/collections" key={collection.id}>
            {collection.title}
          </Link>
        ))}
      </section>
    </div>
  );
}
