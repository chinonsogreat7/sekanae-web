import { ArrowLeft, ArrowRight, ChevronRight, Heart, Maximize2, PackageCheck, Ruler, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, getProduct } from "../api/client";
import { PageMeta } from "../components/PageMeta";
import { ProductCard } from "../components/ProductCard";
import { ProductImage } from "../components/ProductImage";
import { useStore } from "../context/store-context";
import { useCatalog } from "../context/CatalogContext";
import { useDialogFocus } from "../hooks/useDialogFocus";
import { type Product } from "../data/catalog";
import { formatMoney } from "../utils/money";
import { getProductTags, getSwatchClassName, getSwatchStyle } from "../utils/product-display";

const recentlyViewedStorageKey = "sekanae_recently_viewed_products";

function uniqueOverlapScore(values: string[], candidateValues: string[], points: number) {
  const candidateSet = new Set(candidateValues.map((value) => value.toLowerCase()));
  return [...new Set(values.map((value) => value.toLowerCase()))].filter((value) => candidateSet.has(value)).length * points;
}

function relatedProductScore(product: Product, candidate: Product) {
  return [
    candidate.collection === product.collection ? 5 : 0,
    candidate.category === product.category ? 4 : 0,
    candidate.material === product.material ? 2 : 0,
    uniqueOverlapScore(product.occasion, candidate.occasion, 2),
    uniqueOverlapScore(product.colors, candidate.colors, 1),
    uniqueOverlapScore(getProductTags(product), getProductTags(candidate), 2),
  ].reduce((total, score) => total + score, 0);
}

function readRecentlyViewedProductIds() {
  try {
    return JSON.parse(window.localStorage.getItem(recentlyViewedStorageKey) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function ProductPage() {
  const { slug } = useParams();
  const { currency, exchangeRates, addToCart, toggleWishlist, isWishlisted } = useStore();
  const { products, error: catalogError, loading: catalogLoading } = useCatalog();
  const fallbackProduct = products.find((item) => item.slug === slug);
  const [apiProduct, setApiProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(Boolean(slug));
  const [productError, setProductError] = useState<string | null>(null);
  const [resolvedSlug, setResolvedSlug] = useState<string | undefined>();
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const isCurrentProduct = resolvedSlug === slug;
  const absentFromCatalog = !catalogLoading && !catalogError && !fallbackProduct;
  const unavailable = (isCurrentProduct && notFound) || absentFromCatalog;
  const product = unavailable || !fallbackProduct ? undefined : (apiProduct?.slug === slug ? apiProduct : fallbackProduct);
  const [selectedColor, setSelectedColor] = useState(product?.colors[0] ?? "Default");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const galleryRef = useDialogFocus(isGalleryOpen, () => setIsGalleryOpen(false));
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => readRecentlyViewedProductIds());
  const productImages = product?.images ?? [];
  const selectedImage = productImages[selectedImageIndex] ?? productImages[0];
  const pairings = useMemo(() => {
    if (!product) return [];
    return products
      .filter((item) => item.id !== product.id)
      .map((item) => ({ item, score: relatedProductScore(product, item) }))
      .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name))
      .map(({ item }) => item)
      .slice(0, 3);
  }, [product, products]);
  const recentlyViewedProducts = useMemo(() => {
    if (!product) return [];
    return recentlyViewedIds
      .map((productId) => products.find((item) => item.id === productId))
      .filter((item): item is Product => item !== undefined && item.id !== product.id)
      .slice(0, 4);
  }, [product, products, recentlyViewedIds]);

  useEffect(() => {
    if (!slug) return;

    let isCurrent = true;
    setIsLoadingProduct(true);
    setProductError(null);

    getProduct(slug)
      .then((nextProduct) => {
        if (!isCurrent) return;
        setApiProduct(nextProduct);
        setNotFound(false);
        setResolvedSlug(slug);
        setProductError(null);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setApiProduct(null);
        setResolvedSlug(slug);
        setNotFound(error instanceof ApiError && error.status === 404);
        setProductError(error instanceof ApiError && error.status === 404 ? null : "We couldn’t refresh this piece. Please try again to check the latest details.");
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingProduct(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [slug, attempt]);

  useEffect(() => {
    setSelectedColor(product?.colors[0] ?? "Default");
    setSelectedImageIndex(0);
    setIsGalleryOpen(false);
  }, [product?.id, product?.colors]);

  useEffect(() => {
    if (selectedImageIndex >= productImages.length) {
      setSelectedImageIndex(0);
    }
  }, [productImages.length, selectedImageIndex]);

  useEffect(() => {
    if (!product) return;

    setRecentlyViewedIds((currentIds) => {
      const nextIds = [product.id, ...currentIds.filter((productId) => productId !== product.id)].slice(0, 8);
      window.localStorage.setItem(recentlyViewedStorageKey, JSON.stringify(nextIds));
      return nextIds;
    });
  }, [product]);

  useEffect(() => {
    if (!isGalleryOpen) return undefined;

    function onGalleryKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsGalleryOpen(false);
      }

      if (event.key === "ArrowRight") {
        setSelectedImageIndex((index) => (index + 1) % productImages.length);
      }

      if (event.key === "ArrowLeft") {
        setSelectedImageIndex((index) => (index - 1 + productImages.length) % productImages.length);
      }
    }

    window.addEventListener("keydown", onGalleryKeyDown);
    return () => window.removeEventListener("keydown", onGalleryKeyDown);
  }, [isGalleryOpen, productImages.length]);

  if (!product) {
    return (
      <div className="page section-pad">
        <PageMeta title={unavailable ? "Product not found" : "Product details"} path={`/product/${slug ?? ""}`} description="Explore the SEKANAE collection." />
        <div className="empty-state">
          <h1>{unavailable ? "Product not found" : isLoadingProduct || !isCurrentProduct ? "Loading this piece…" : "This piece couldn’t be loaded"}</h1>
          <p role="status">{unavailable ? "This piece is no longer available." : isLoadingProduct || !isCurrentProduct ? "Just a moment." : "Please try again in a moment."}</p>
          {!isLoadingProduct && !unavailable && <button type="button" className="secondary-button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>}
          <Link to="/shop" className="primary-button">Return to shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageMeta
        title={product.name}
        path={`/product/${product.slug}`}
        description={product.description}
      />
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/shop">Shop</Link>
        <ChevronRight size={14} />
        <span>{product.name}</span>
      </nav>

      <section className="product-detail">
        <div className="product-gallery" aria-label={`${product.name} image gallery`}>
          <button
            className="main-product-image-button"
            type="button"
            title="View larger"
            disabled={!productImages.length}
            onClick={() => setIsGalleryOpen(true)}
            aria-label={`Open ${product.name} image gallery`}
          >
            <ProductImage
              className="main-product-image"
              images={selectedImage ? [selectedImage] : []}
              alt={product.name}
            />
            <span className="gallery-zoom-icon" aria-hidden="true"><Maximize2 size={18} /></span>
          </button>
          <div className="product-thumbnails" aria-label="Select product image">
            {productImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                aria-label={`Show ${product.name} image ${index + 1}`}
                aria-pressed={selectedImageIndex === index}
                onClick={() => setSelectedImageIndex(index)}
              >
                <ProductImage
                  images={[image]}
                  alt=""
                />
              </button>
            ))}
          </div>
        </div>
        <div className="product-info-panel">
          <p className="microcopy">{product.collection}</p>
          <h1>{product.name}</h1>
          {(productError || catalogError) && <div className="api-status" role="status">{productError ?? catalogError} <button type="button" className="text-link" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>}
          {isLoadingProduct && <p className="api-status">Refreshing product details.</p>}
          <p className="product-price">{formatMoney(product.price, currency, exchangeRates)}</p>
          <p>{product.description}</p>
          <div className="color-row">
            {product.colors.map((colorName) => (
              <button
                key={colorName}
                type="button"
                aria-pressed={selectedColor === colorName}
                onClick={() => setSelectedColor(colorName)}
              >
                <span className={getSwatchClassName(colorName)} style={getSwatchStyle(colorName)} />
                {colorName}
              </button>
            ))}
          </div>
          <div className="product-cta-row">
            <button className="primary-button" type="button" disabled={product.stock < 1 || isLoadingProduct || !isCurrentProduct} onClick={() => addToCart(product.id, selectedColor)}>
              {product.stock < 1 ? "Sold out" : "Add to cart"}
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

      <section className="section-pad">
        <h2>Complete the Look</h2>
        <div className="product-grid">
          {pairings.map((item) => <ProductCard key={item.id} product={item} />)}
        </div>
      </section>

      {recentlyViewedProducts.length > 0 && (
        <section className="section-pad recently-viewed-section">
          <h2>Recently Viewed</h2>
          <div className="product-grid">
            {recentlyViewedProducts.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      )}

      {isGalleryOpen && (
        <div ref={galleryRef} className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`${product.name} image gallery`}>
          <button className="gallery-close" type="button" onClick={() => setIsGalleryOpen(false)} aria-label="Close gallery">
            <X size={22} />
          </button>
          <button
            className="gallery-nav gallery-nav-prev"
            type="button"
            onClick={() => setSelectedImageIndex((index) => (index - 1 + productImages.length) % productImages.length)}
            aria-label="Previous image"
          >
            <ArrowLeft size={22} />
          </button>
          <ProductImage
            images={selectedImage ? [selectedImage] : []}
            alt={`${product.name} large view`}
          />
          <button
            className="gallery-nav gallery-nav-next"
            type="button"
            onClick={() => setSelectedImageIndex((index) => (index + 1) % productImages.length)}
            aria-label="Next image"
          >
            <ArrowRight size={22} />
          </button>
          <p>{selectedImageIndex + 1} / {productImages.length}</p>
        </div>
      )}
    </div>
  );
}
