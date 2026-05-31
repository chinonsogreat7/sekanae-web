import { Eye, Heart, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { type Product } from "../data/catalog";
import { useStore } from "../context/store-context";
import { formatMoney } from "../utils/money";
import { getProductTags, getSwatchClassName, getSwatchStyle } from "../utils/product-display";

type ProductCardProps = {
  product: Product;
  onQuickView?: (product: Product) => void;
};

export function ProductCard({ product, onQuickView }: ProductCardProps) {
  const { currency, exchangeRates, addToCart, toggleWishlist, isWishlisted } = useStore();
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  const fallbackImage = "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1000&q=85";

  return (
    <article className="product-card">
      <Link to={`/product/${product.slug}`} className="product-image-link" aria-label={product.name}>
        <img
          src={product.images[0]}
          alt={product.name}
          decoding="async"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = fallbackImage;
          }}
        />
        <div className="product-flags">
          {getProductTags(product).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </Link>
      <div className="product-card-body">
        <div>
          <p className="microcopy">{product.category}</p>
          <h3>
            <Link to={`/product/${product.slug}`}>{product.name}</Link>
          </h3>
          <p>{formatMoney(product.price, currency, exchangeRates)}</p>
        </div>
        <div className="swatches" aria-label={`${product.name} colors`}>
          {product.colors.map((color) => (
            <button
              key={color}
              type="button"
              title={`Select ${color}`}
              aria-label={`Select ${color}`}
              aria-pressed={selectedColor === color}
              className={getSwatchClassName(color)}
              style={getSwatchStyle(color)}
              onClick={() => setSelectedColor(color)}
            />
          ))}
        </div>
      </div>
      <div className="product-actions">
        <button type="button" onClick={() => addToCart(product.id, selectedColor)}>
          <ShoppingBag size={16} />
          Add
        </button>
        <button type="button" onClick={() => toggleWishlist(product.id)} aria-pressed={isWishlisted(product.id)}>
          <Heart size={16} fill={isWishlisted(product.id) ? "currentColor" : "none"} />
          <span>Save</span>
        </button>
        <button type="button" onClick={() => onQuickView?.(product)}>
          <Eye size={16} />
          <span>View</span>
        </button>
      </div>
    </article>
  );
}
