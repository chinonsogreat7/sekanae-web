import { Camera, Mail, MapPin } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { getApiBaseUrl } from "../api/config";

const apiBaseUrl = getApiBaseUrl();

export function Footer() {
  const [email, setEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNewsletterStatus(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/newsletter/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          source: "footer",
        }),
      });

      if (!response.ok) {
        throw new Error("Newsletter signup failed.");
      }

      setEmail("");
      setNewsletterStatus("You're on the list.");
    } catch {
      setNewsletterStatus("Newsletter signup is unavailable right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <footer className="site-footer">
      <section className="newsletter" aria-labelledby="newsletter-title">
        <div>
          <h2 id="newsletter-title">Sign up for SEKANAE News</h2>
          <p>
            Be the first to discover new arrivals, stories, and private client previews.
          </p>
        </div>
        <form className="newsletter-form" onSubmit={subscribe}>
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Joining" : "Join"}</button>
          {newsletterStatus && <p className="newsletter-status">{newsletterStatus}</p>}
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
          <h3>Client Services</h3>
          <Link to="/shipping">Shipping</Link>
          <Link to="/returns">Returns</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/client-care">Contact Concierge</Link>
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
