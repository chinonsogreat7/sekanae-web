import { Link } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";
import { ProductCard } from "../components/ProductCard";
import { products } from "../data/catalog";

export function BridalPage() {
  const bridalProducts = products.filter((product) => product.isBridalPreview);

  return (
    <div className="page">
      <PageMeta
        title="Bridal Atelier"
        path="/bridal"
        description="Preview SEKANAE Bridal Atelier pieces for destination weddings, keepsake gifts, ceremony clutches, and refined accessories."
      />
      <section className="bridal-page-hero">
        <div>
          <h1>The Bridal Atelier is coming soon</h1>
          <p>
            A refined collection of jewelry, ceremony clutches, keepsake gifts, and
            accessories for destination weddings and the women gathered around them.
          </p>
          <Link to="/client-care" className="primary-button">Request private preview</Link>
        </div>
      </section>
      <section className="section-pad">
        <h2>Preview Pieces</h2>
        <div className="product-grid">
          {bridalProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>
    </div>
  );
}
