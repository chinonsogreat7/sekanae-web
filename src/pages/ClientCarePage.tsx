import { Mail, MessageCircle, PackageCheck, RotateCcw } from "lucide-react";

export function ClientCarePage() {
  return (
    <div className="page">
      <section className="page-hero care-hero">
        <div>
          <h1>Client Care</h1>
          <p>
            Concierge-style support for international shipping, gifts, materials,
            returns, and Bridal Atelier private preview requests.
          </p>
        </div>
      </section>
      <section className="care-layout section-pad">
        <div className="faq-grid">
          <article><PackageCheck size={22} /><h2>Shipping</h2><p>Tracked international delivery with express options for selected markets.</p></article>
          <article><RotateCcw size={22} /><h2>Returns</h2><p>Eligible unused pieces may be returned within 14 days in original packaging.</p></article>
          <article><Mail size={22} /><h2>Materials</h2><p>Care guidance is included with every piece, from silk and leather to pearls and vermeil.</p></article>
          <article><MessageCircle size={22} /><h2>Concierge</h2><p>Request styling, gifting, or Bridal Atelier guidance from the SEKANAE client care team.</p></article>
        </div>
        <form className="concierge-form">
          <h2>Contact the Concierge</h2>
          <label>Name<input required /></label>
          <label>Email<input type="email" required /></label>
          <label>Topic
            <select>
              <option>Product guidance</option>
              <option>Shipping and returns</option>
              <option>Gift packaging</option>
              <option>Bridal Atelier preview</option>
            </select>
          </label>
          <label>Message<textarea rows={5} /></label>
          <button className="primary-button" type="submit">Send request</button>
        </form>
      </section>
    </div>
  );
}
