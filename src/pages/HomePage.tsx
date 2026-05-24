import { ArrowRight, MoveRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { PageMeta } from "../components/PageMeta";
import { SectionHeading } from "../components/SectionHeading";
import { collections, products } from "../data/catalog";
import { journalPosts } from "../data/editorial";

export function HomePage() {
  const newArrivals = products.filter((product) => product.isNew || product.isBridalPreview).slice(0, 5);

  return (
    <div className="page boutique-home">
      <PageMeta
        title="SEKANAÉ | Luxury Accessories for Women of the World"
        path="/"
        description="SEKANAE is a refined accessories maison for modern international women, offering jewelry, handbags, scarves, travel accessories, gifts, and Bridal Atelier previews."
      />
      <section className="hero-section">
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
        <div className="hero-media" aria-label="SEKANAE luxury accessories editorial">
          <img
            src="https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=1400&q=88"
            alt="Elegant woman carrying luxury accessories while traveling"
            decoding="async"
            fetchPriority="high"
          />
        </div>
      </section>

      <section className="section-pad">
        <div className="category-grid boutique-category-grid">
          {[
            ["Jewelry", "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=85"],
            ["Handbags", "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=85"],
            ["Scarves", "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&q=85"],
            ["Travel Accessories", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85"],
            ["Gift Shop", "https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=900&q=85"],
          ].map(([title, image]) => (
            <Link to={`/shop?category=${encodeURIComponent(title)}`} className="category-tile" key={title}>
              <img src={image} alt={`${title} from SEKANAE`} loading="lazy" />
              <span>{title}<MoveRight size={14} strokeWidth={1.4} aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-pad product-band">
        <SectionHeading
          title="New Arrivals"
        >
          <Link to="/shop?sort=new" className="text-link">
            View all <ArrowRight size={16} />
          </Link>
        </SectionHeading>
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
