import { Link } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";
import { SectionHeading } from "../components/SectionHeading";
import { useCollections } from "../hooks/useCollections";

export function CollectionsPage() {
  const { collections, loading, error, retry } = useCollections();
  return (
    <div className="page">
      <PageMeta
        title="Curated Collections"
        path="/collections"
        description="Explore SEKANAE collections for travel, evening, gold, everyday elegance, new arrivals, and considered gifting."
      />
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
        {loading && !collections.length && <p role="status">Loading collections…</p>}
        {error && <div role="status"><p>Collections couldn’t load. Please try again.</p><button className="secondary-button" type="button" onClick={retry}>Try again</button></div>}
        {!loading && !error && !collections.length && <p>No collections are available right now. Please check back soon.</p>}
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
