import { Link } from "react-router-dom";
import { SectionHeading } from "../components/SectionHeading";
import { collections } from "../data/catalog";

export function CollectionsPage() {
  return (
    <div className="page">
      <section className="page-hero collections-hero">
        <div>
          <h1>Curated Collections</h1>
          <p>
            Shop by destination, mood, occasion, and the quiet confidence of timeless
            accessories.
          </p>
        </div>
      </section>
      <section className="section-pad">
        <SectionHeading title="Edits for every destination" copy="Travel, evening, gold, everyday elegance, and new arrivals." />
        <div className="collection-grid large">
          {collections.map((collection) => (
            <article className="collection-card" key={collection.id}>
              <img src={collection.image} alt={collection.title} />
              <div>
                <h2>{collection.title}</h2>
                <p>{collection.description}</p>
                <Link to="/shop" className="text-link">{collection.cta}</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
