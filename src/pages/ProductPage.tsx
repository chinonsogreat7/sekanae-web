import { ChevronRight, Heart, PackageCheck, Ruler, ShieldCheck, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProduct } from "../api/client";
import { ProductCard } from "../components/ProductCard";
import { useStore } from "../context/StoreContext";
import { useCatalog } from "../context/CatalogContext";
import { type Product } from "../data/catalog";
import { formatMoney } from "../utils/money";

export function ProductPage() {
  const { slug } = useParams();
  const { currency, addToCart, toggleWishlist, isWishlisted } = useStore();
  const { products, error: catalogError } = useCatalog();
  const fallbackProduct = products.find((item) => item.slug === slug) ?? products[0];
  const [apiProduct, setApiProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(Boolean(slug));
  const [productError, setProductError] = useState<string | null>(null);
  const product = apiProduct ?? fallbackProduct;
  const [selectedColor, setSelectedColor] = useState(product?.colors[0] ?? "Default");
  const fallbackImage = "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1000&q=85";
  const pairings = useMemo(() => {
    if (!product) return [];
    return products
      .filter((item) => item.id !== product.id && item.collection === product.collection)
      .concat(products.filter((item) => item.id !== product.id))
      .slice(0, 3);
  }, [product, products]);

  useEffect(() => {
    if (!slug) return;

    let isCurrent = true;
    setIsLoadingProduct(true);

    getProduct(slug)
      .then((nextProduct) => {
        if (!isCurrent) return;
        setApiProduct(nextProduct);
        setProductError(null);
      })
      .catch(() => {
        if (!isCurrent) return;
        setApiProduct(null);
        setProductError("Product details are using saved catalog data while the API is unavailable.");
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingProduct(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [slug]);

  useEffect(() => {
    setSelectedColor(product?.colors[0] ?? "Default");
  }, [product?.id, product?.colors]);

  if (!product) {
    return (
      <div className="page section-pad">
        <div className="empty-state">
          <h1>Product not found</h1>
          <p>This piece is no longer available.</p>
          <Link to="/shop" className="primary-button">Return to shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/shop">Shop</Link>
        <ChevronRight size={14} />
        <span>{product.name}</span>
      </nav>

      <section className="product-detail">
        <div className="product-gallery">
          <img
            className="main-product-image"
            src={product.images[0]}
            alt={product.name}
            onError={(event) => {
              event.currentTarget.src = fallbackImage;
            }}
          />
          {product.images.map((image) => (
            <img
              key={image}
              src={image}
              alt={`${product.name} detail`}
              onError={(event) => {
                event.currentTarget.src = fallbackImage;
              }}
            />
          ))}
        </div>
        <div className="product-info-panel">
          <p className="microcopy">{product.collection}</p>
          <h1>{product.name}</h1>
          {(productError || catalogError) && <p className="api-status">{productError ?? catalogError}</p>}
          {isLoadingProduct && <p className="api-status">Refreshing product details.</p>}
          <div className="rating-row">
            <span><Star size={16} fill="currentColor" /> {product.rating}</span>
            <span>{product.reviews} customer reviews</span>
          </div>
          <p className="product-price">{formatMoney(product.price, currency)}</p>
          <p>{product.description}</p>
          <div className="color-row">
            {product.colors.map((colorName) => (
              <button
                key={colorName}
                type="button"
                aria-pressed={selectedColor === colorName}
                onClick={() => setSelectedColor(colorName)}
              >
                <span className={`swatch swatch-${colorName.toLowerCase().replaceAll(" ", "-")}`} />
                {colorName}
              </button>
            ))}
          </div>
          <div className="product-cta-row">
            <button className="primary-button" type="button" onClick={() => addToCart(product.id, selectedColor)}>
              Add to cart
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-pressed={isWishlisted(product.id)}
            >
              <Heart size={16} fill={isWishlisted(product.id) ? "currentColor" : "none"} />
              Wishlist
            </button>
          </div>
          <div className="service-notes">
            <span><ShieldCheck size={18} /> Secure checkout</span>
            <span><PackageCheck size={18} /> International shipping</span>
            <span><Ruler size={18} /> Dimensions included</span>
          </div>

          <div className="accordion-stack">
            <details open>
              <summary>Materials</summary>
              <p>{product.details.materials}</p>
            </details>
            <details>
              <summary>Dimensions</summary>
              <p>{product.details.dimensions}</p>
            </details>
            <details>
              <summary>Care</summary>
              <p>{product.details.care}</p>
            </details>
            <details>
              <summary>Shipping</summary>
              <p>{product.details.shipping}</p>
            </details>
          </div>
        </div>
      </section>

      <section className="section-pad reviews-section">
        <h2>Customer Notes</h2>
        <div className="review-grid">
          <blockquote>
            <p>"Elegant without feeling delicate. The packaging felt like opening a private invitation."</p>
            <cite>Amara, Lagos</cite>
          </blockquote>
          <blockquote>
            <p>"A piece I can wear at work and still take straight into dinner."</p>
            <cite>Claire, London</cite>
          </blockquote>
        </div>
      </section>

      <section className="section-pad">
        <h2>Complete the Look</h2>
        <div className="product-grid">
          {pairings.map((item) => <ProductCard key={item.id} product={item} />)}
        </div>
      </section>
    </div>
  );
}
