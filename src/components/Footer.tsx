import { Camera, Mail, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="site-footer">
      <section className="newsletter" aria-labelledby="newsletter-title">
        <div>
          <h2 id="newsletter-title">Sign up for SEKANAE News</h2>
          <p>
            Be the first to discover new arrivals, stories, and private client previews.
          </p>
        </div>
        <form className="newsletter-form">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input id="newsletter-email" type="email" placeholder="Email address" />
          <button type="submit">Join</button>
        </form>
      </section>

      <div className="footer-grid">
        <div>
          <Link to="/" className="brand-mark footer-brand">
            SEKANAE
          </Link>
          <p>
            Accessories with a global point of view, crafted to accompany your finest
            moments.
          </p>
        </div>
        <div>
          <h3>Shop</h3>
          <Link to="/shop">All Accessories</Link>
          <Link to="/shop?category=Jewelry">Jewelry</Link>
          <Link to="/shop?category=Handbags">Handbags</Link>
          <Link to="/collections">Collections</Link>
        </div>
        <div>
          <h3>Discover</h3>
          <Link to="/lookbook">The Journal</Link>
          <Link to="/bridal">Bridal Atelier</Link>
          <Link to="/client-care">Client Care</Link>
          <Link to="/about">Our World</Link>
        </div>
        <div>
          <h3>Social</h3>
          <span><Camera size={16} /> @sekanae.co</span>
          <span><Mail size={16} /> care@sekanae.co</span>
          <span><MapPin size={16} /> Global delivery</span>
        </div>
      </div>
    </footer>
  );
}
