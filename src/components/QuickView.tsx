import { useDialogFocus } from "../hooks/useDialogFocus";
import { X } from "lucide-react";
import { type Product } from "../data/catalog";
import { useStore } from "../context/store-context";
import { formatMoney } from "../utils/money";
import { ProductImage } from "./ProductImage";

type QuickViewProps = {
  product: Product | null;
  onClose: () => void;
};

export function QuickView({ product, onClose }: QuickViewProps) {
  const dialogRef = useDialogFocus(Boolean(product), onClose);
  const { currency, exchangeRates, addToCart } = useStore();

  if (!product) {
    return null;
  }

  return (
    <div ref={dialogRef} className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${product.name} quick view`}>
      <div className="quick-view">
        <button className="icon-button modal-close" type="button" aria-label="Close quick view" onClick={onClose}>
          <X size={20} />
        </button>
        <ProductImage images={product.images} alt={product.name} />
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
          <button className="primary-button" type="button" disabled={product.stock < 1} onClick={() => addToCart(product.id)}>
            {product.stock < 1 ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
