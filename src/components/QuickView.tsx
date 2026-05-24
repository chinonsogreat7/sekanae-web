import { X } from "lucide-react";
import { type Product } from "../data/catalog";
import { useStore } from "../context/StoreContext";
import { formatMoney } from "../utils/money";

type QuickViewProps = {
  product: Product | null;
  onClose: () => void;
};

export function QuickView({ product, onClose }: QuickViewProps) {
  const { currency, exchangeRates, addToCart } = useStore();

  if (!product) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${product.name} quick view`}>
      <div className="quick-view">
        <button className="icon-button modal-close" type="button" aria-label="Close quick view" onClick={onClose}>
          <X size={20} />
        </button>
        <img src={product.images[0]} alt={product.name} />
        <div>
          <p className="microcopy">{product.collection}</p>
          <h2>{product.name}</h2>
          <p className="price-line">{formatMoney(product.price, currency, exchangeRates)}</p>
          <p>{product.description}</p>
          <dl className="detail-list">
            <div>
              <dt>Material</dt>
              <dd>{product.material}</dd>
            </div>
            <div>
              <dt>Occasion</dt>
              <dd>{product.occasion.join(", ")}</dd>
            </div>
          </dl>
          <button className="primary-button" type="button" onClick={() => addToCart(product.id)}>
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
