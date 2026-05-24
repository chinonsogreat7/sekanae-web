import { Link } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <PageMeta
        title="Page Not Found | SEKANAE"
        description="The requested SEKANAE page could not be found. Return home, browse the collection, or contact Client Care."
        path="/404"
      />
      <Link className="not-found-brand" to="/" aria-label="SEKANAE home">
        SEKANAE
      </Link>
      <section className="not-found-shell" aria-labelledby="not-found-title">
        <div className="not-found-copy">
          <p className="microcopy">404 / Lost address</p>
          <h1 id="not-found-title">
            <span>This page</span>
            <span>slipped out</span>
            <span>of the</span>
            <span>collection.</span>
          </h1>
          <p>
            The link may have changed, the piece may have moved, or the address may
            need a second look. Return to the maison and continue from there.
          </p>
          <div className="not-found-actions">
            <Link className="primary-button" to="/">Return home</Link>
            <Link className="secondary-button" to="/shop">Shop collection</Link>
          </div>
        </div>
        <div className="not-found-card" aria-label="Suggested destinations">
          <span>Suggested paths</span>
          <Link to="/collections">Curated Collections</Link>
          <Link to="/client-care">Client Care</Link>
          <Link to="/bridal">Bridal Atelier</Link>
        </div>
      </section>
    </main>
  );
}
