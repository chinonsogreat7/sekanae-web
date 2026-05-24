import {
  BarChart3,
  Boxes,
  ClipboardList,
  Edit3,
  Globe2,
  MailCheck,
  PackagePlus,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getProducts } from "../api/client";
import { products as fallbackProducts, type CurrencyCode, type Product, type ProductCategory } from "../data/catalog";
import { adminMetrics } from "../data/editorial";
import { formatMoney } from "../utils/money";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const adminTokenStorageKey = "sekanae_admin_token";

const productCategories: ProductCategory[] = [
  "Jewelry",
  "Handbags",
  "Scarves",
  "Sunglasses",
  "Leather Goods",
  "Travel Accessories",
  "Gift Shop",
];

const orderStatuses = ["pending", "paid", "processing", "fulfilled", "cancelled", "refunded"] as const;
const paymentStatuses = ["unpaid", "requires_action", "paid", "failed", "refunded"] as const;

type NewsletterStats = {
  subscribed: number;
  unsubscribed: number;
  campaigns: number;
};

type NewsletterCampaign = {
  id: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
};

type AdminSessionResponse = {
  data: {
    authenticated: boolean;
    token: string;
    email: string;
    expiresAt: string;
  };
};

type ProductDraft = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  collection: string;
  price: string;
  colors: string;
  material: string;
  occasion: string;
  images: string;
  description: string;
  detailsMaterials: string;
  detailsDimensions: string;
  detailsCare: string;
  detailsShipping: string;
  rating: string;
  reviews: string;
  stock: string;
  isNew: boolean;
  isBridalPreview: boolean;
};

type Address = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
};

type Customer = {
  email: string;
  name: string;
  phone?: string;
};

type OrderStatus = typeof orderStatuses[number];
type PaymentStatus = typeof paymentStatuses[number];

type OrderItem = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type Order = {
  id: string;
  customer: Customer;
  currency: CurrencyCode;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  taxRate: number;
  taxIncluded: boolean;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider?: string;
  paymentReference?: string;
  shippingAddress: Address;
  billingAddress?: Address;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

type ApiPayload<TData> = {
  data?: TData;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
  error?: {
    message?: string;
  };
};

type ApiDataPayload<TData> = ApiPayload<TData> & {
  data: TData;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createProductDraft(): ProductDraft {
  return {
    id: `p-${Date.now().toString(36)}`,
    slug: "",
    name: "",
    category: "Jewelry",
    collection: "",
    price: "",
    colors: "",
    material: "",
    occasion: "",
    images: "",
    description: "",
    detailsMaterials: "",
    detailsDimensions: "",
    detailsCare: "",
    detailsShipping: "",
    rating: "0",
    reviews: "0",
    stock: "0",
    isNew: false,
    isBridalPreview: false,
  };
}

function productToDraft(product: Product): ProductDraft {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    collection: product.collection,
    price: String(product.price),
    colors: product.colors.join(", "),
    material: product.material,
    occasion: product.occasion.join(", "),
    images: product.images.join("\n"),
    description: product.description,
    detailsMaterials: product.details.materials,
    detailsDimensions: product.details.dimensions,
    detailsCare: product.details.care,
    detailsShipping: product.details.shipping,
    rating: String(product.rating),
    reviews: String(product.reviews),
    stock: String(product.stock),
    isNew: Boolean(product.isNew),
    isBridalPreview: Boolean(product.isBridalPreview),
  };
}

function draftToProduct(draft: ProductDraft): Product {
  return {
    id: draft.id.trim(),
    slug: draft.slug.trim() || slugify(draft.name),
    name: draft.name.trim(),
    category: draft.category,
    collection: draft.collection.trim(),
    price: Number(draft.price),
    colors: parseList(draft.colors),
    material: draft.material.trim(),
    occasion: parseList(draft.occasion),
    images: parseList(draft.images),
    description: draft.description.trim(),
    details: {
      materials: draft.detailsMaterials.trim(),
      dimensions: draft.detailsDimensions.trim(),
      care: draft.detailsCare.trim(),
      shipping: draft.detailsShipping.trim(),
    },
    rating: Number(draft.rating),
    reviews: Number(draft.reviews),
    stock: Number(draft.stock),
    isNew: draft.isNew || undefined,
    isBridalPreview: draft.isBridalPreview || undefined,
  };
}

function addressLine(address?: Address) {
  if (!address) {
    return "No address saved";
  }

  return [address.line1, address.line2, address.city, address.region, address.postalCode, address.country]
    .filter(Boolean)
    .join(", ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function AdminPage() {
  const [adminToken, setAdminToken] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [newsletterStats, setNewsletterStats] = useState<NewsletterStats | null>(null);
  const [campaignResult, setCampaignResult] = useState<NewsletterCampaign | null>(null);
  const [newsletterMessage, setNewsletterMessage] = useState<string | null>(null);
  const [isSendingNewsletter, setIsSendingNewsletter] = useState(false);
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [html, setHtml] = useState("<p>A new SEKANAE edit is now available.</p>");
  const [text, setText] = useState("A new SEKANAE edit is now available.");
  const [adminProducts, setAdminProducts] = useState<Product[]>(fallbackProducts);
  const [productDraft, setProductDraft] = useState<ProductDraft>(() => createProductDraft());
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [inventoryDrafts, setInventoryDrafts] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<"" | OrderStatus>("");
  const [orderEmailFilter, setOrderEmailFilter] = useState("");
  const [ordersMessage, setOrdersMessage] = useState<string | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("pending");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [orderNotes, setOrderNotes] = useState("");

  const visibleProducts = useMemo(() => adminProducts.slice(0, 8), [adminProducts]);

  useEffect(() => {
    const savedToken = window.sessionStorage.getItem(adminTokenStorageKey);

    if (!savedToken) {
      return;
    }

    const token = savedToken;

    async function restoreSession() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/admin/session`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          window.sessionStorage.removeItem(adminTokenStorageKey);
          return;
        }

        setAdminToken(token);
        setIsAuthenticated(true);
      } catch {
        window.sessionStorage.removeItem(adminTokenStorageKey);
      }
    }

    void restoreSession();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !adminToken) {
      return;
    }

    void readProducts();
    void readOrders();
    void readNewsletterStats();
    // Dashboard data should hydrate only after auth changes; filters refresh through Apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, adminToken]);

  async function readAdmin<TData>(path: string, options: RequestInit = {}): Promise<ApiDataPayload<TData>> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const payload = await response.json() as ApiPayload<TData>;

    if (!response.ok || payload.data === undefined) {
      throw new Error(payload.error?.message ?? `Request failed with status ${response.status}.`);
    }

    return payload as ApiDataPayload<TData>;
  }

  async function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });
      const payload = await response.json() as Partial<AdminSessionResponse> & { error?: { message?: string } };

      if (!response.ok || !payload.data?.token) {
        throw new Error(payload.error?.message ?? "Invalid email or password.");
      }

      window.sessionStorage.setItem(adminTokenStorageKey, payload.data.token);
      setAdminToken(payload.data.token);
      setLoginPassword("");
      setIsAuthenticated(true);
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "Admin login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function signOut() {
    window.sessionStorage.removeItem(adminTokenStorageKey);
    setAdminToken("");
    setLoginPassword("");
    setIsAuthenticated(false);
    setNewsletterStats(null);
    setCampaignResult(null);
    setSelectedOrder(null);
  }

  async function readProducts() {
    try {
      const productList = await getProducts();
      setAdminProducts(productList);
      setInventoryDrafts(Object.fromEntries(productList.map((product) => [product.id, String(product.stock)])));
      setProductMessage(null);
    } catch {
      setAdminProducts(fallbackProducts);
      setInventoryDrafts(Object.fromEntries(fallbackProducts.map((product) => [product.id, String(product.stock)])));
      setProductMessage("Live products are unavailable, so the studio is showing the local fallback catalog.");
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminToken) {
      setProductMessage("Sign in again to continue.");
      return;
    }

    setIsSavingProduct(true);
    setProductMessage(null);

    try {
      const product = draftToProduct(productDraft);
      const payload = await readAdmin<Product>("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(product),
      });

      setProductMessage(`${payload.data.name} has been saved.`);
      setProductDraft(productToDraft(payload.data));
      await readProducts();
    } catch (error) {
      setProductMessage(error instanceof Error ? error.message : "Product save failed.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function archiveProduct(productId: string) {
    if (!window.confirm("Archive this product? It will be hidden from the live catalog.")) {
      return;
    }

    try {
      await readAdmin<{ archived: boolean }>(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
      setProductMessage("Product archived.");
      await readProducts();
    } catch (error) {
      setProductMessage(error instanceof Error ? error.message : "Product archive failed.");
    }
  }

  async function updateInventory(productId: string) {
    const quantity = Number(inventoryDrafts[productId]);

    if (!Number.isInteger(quantity) || quantity < 0) {
      setProductMessage("Inventory must be a whole number.");
      return;
    }

    try {
      const payload = await readAdmin<Product>(`/api/admin/products/${encodeURIComponent(productId)}/inventory`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      });
      setProductMessage(`${payload.data.name} inventory updated to ${payload.data.stock}.`);
      await readProducts();
    } catch (error) {
      setProductMessage(error instanceof Error ? error.message : "Inventory update failed.");
    }
  }

  async function readOrders() {
    if (!adminToken) {
      return;
    }

    setIsLoadingOrders(true);
    setOrdersMessage(null);

    const query = new URLSearchParams({ limit: "50" });

    if (orderStatusFilter) {
      query.set("status", orderStatusFilter);
    }

    if (orderEmailFilter.trim()) {
      query.set("email", orderEmailFilter.trim());
    }

    try {
      const payload = await readAdmin<Order[]>(`/api/admin/orders?${query.toString()}`);
      setOrders(payload.data);
      setOrdersTotal(payload.meta?.total ?? payload.data.length);
      if (!payload.data.length) {
        setOrdersMessage("No orders match this view yet.");
      }
    } catch (error) {
      setOrders([]);
      setOrdersTotal(0);
      setOrdersMessage(error instanceof Error ? error.message : "Orders are unavailable.");
    } finally {
      setIsLoadingOrders(false);
    }
  }

  async function readOrderDetail(orderId: string) {
    try {
      const payload = await readAdmin<Order>(`/api/admin/orders/${encodeURIComponent(orderId)}`);
      setSelectedOrder(payload.data);
      setOrderStatus(payload.data.status);
      setPaymentStatus(payload.data.paymentStatus);
      setOrderNotes(payload.data.notes ?? "");
      setOrdersMessage(null);
    } catch (error) {
      setOrdersMessage(error instanceof Error ? error.message : "Order detail is unavailable.");
    }
  }

  async function updateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedOrder) {
      return;
    }

    try {
      const payload = await readAdmin<Order>(`/api/admin/orders/${encodeURIComponent(selectedOrder.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: orderStatus,
          paymentStatus,
          notes: orderNotes || undefined,
        }),
      });
      setSelectedOrder(payload.data);
      setOrderStatus(payload.data.status);
      setPaymentStatus(payload.data.paymentStatus);
      setOrderNotes(payload.data.notes ?? "");
      setOrdersMessage("Order updated.");
      await readOrders();
    } catch (error) {
      setOrdersMessage(error instanceof Error ? error.message : "Order update failed.");
    }
  }

  async function readNewsletterStats() {
    if (!adminToken) {
      setNewsletterMessage("Sign in again to continue.");
      return;
    }

    try {
      const payload = await readAdmin<NewsletterStats>("/api/admin/newsletter/stats");
      setNewsletterStats(payload.data);
      setNewsletterMessage(null);
    } catch {
      setNewsletterMessage("Newsletter stats are unavailable.");
    }
  }

  async function sendNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminToken) {
      setNewsletterMessage("Sign in again to continue.");
      return;
    }

    setIsSendingNewsletter(true);
    setNewsletterMessage(null);
    setCampaignResult(null);

    try {
      const payload = await readAdmin<NewsletterCampaign>("/api/admin/newsletter/campaigns/send", {
        method: "POST",
        body: JSON.stringify({
          subject,
          previewText: previewText || undefined,
          html,
          text: text || undefined,
        }),
      });

      setCampaignResult(payload.data);
      setNewsletterMessage("Newsletter campaign sent.");
      await readNewsletterStats();
    } catch (error) {
      setNewsletterMessage(error instanceof Error ? error.message : "Newsletter send failed.");
    } finally {
      setIsSendingNewsletter(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login-page">
        <section className="admin-login-panel">
          <p className="microcopy">Admin Studio</p>
          <h1>SEKANAE access</h1>
          <form onSubmit={submitAdminLogin}>
            <label>
              Email
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                placeholder="admin@sekanae.co"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? "Checking access" : "Sign in"}
            </button>
          </form>
          {loginMessage && <p className="admin-status">{loginMessage}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="brand-mark">SEKANAE</div>
        <a href="#dashboard"><BarChart3 size={18} /> Dashboard</a>
        <a href="#products"><Boxes size={18} /> Products</a>
        <a href="#orders"><ClipboardList size={18} /> Orders</a>
        <a href="#newsletter"><MailCheck size={18} /> Newsletter</a>
        <a href="#content"><Edit3 size={18} /> Content</a>
        <a href="#markets"><Globe2 size={18} /> Markets</a>
        <a href="#settings"><Settings size={18} /> Settings</a>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="microcopy">Admin Studio</p>
            <h1>Manage SEKANAE</h1>
          </div>
          <div className="admin-search">
            <Search size={16} />
            <input placeholder="Search products, orders, clients" />
          </div>
          <button className="admin-sign-out" type="button" onClick={signOut}>
            Sign out
          </button>
        </header>

        <section className="admin-metrics" id="dashboard">
          {adminMetrics.map((metric) => (
            <article key={metric.label}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.trend}</span>
            </article>
          ))}
        </section>

        <section className="admin-grid admin-grid-wide">
          <article className="admin-panel admin-panel-wide" id="products">
            <div className="panel-heading">
              <h2>Product Catalog</h2>
              <button type="button" onClick={() => setProductDraft(createProductDraft())}>
                <PackagePlus size={16} /> New product
              </button>
            </div>
            <div className="admin-table admin-product-table">
              <div className="admin-table-head">
                <span>Product</span><span>Category</span><span>Inventory</span><span>Actions</span>
              </div>
              {visibleProducts.map((product) => (
                <div className="admin-row" key={product.id}>
                  <span><img src={product.images[0]} alt="" /> {product.name}</span>
                  <span>{product.category}</span>
                  <span className="admin-stock-control">
                    <input
                      type="number"
                      min="0"
                      value={inventoryDrafts[product.id] ?? String(product.stock)}
                      onChange={(event) => setInventoryDrafts((current) => ({
                        ...current,
                        [product.id]: event.target.value,
                      }))}
                      aria-label={`${product.name} inventory`}
                    />
                    <button type="button" onClick={() => updateInventory(product.id)}>Update</button>
                  </span>
                  <span className="admin-row-actions">
                    <button type="button" onClick={() => setProductDraft(productToDraft(product))}>Edit</button>
                    <button className="admin-danger" type="button" onClick={() => archiveProduct(product.id)}>
                      <Trash2 size={14} /> Archive
                    </button>
                  </span>
                </div>
              ))}
            </div>
            {productMessage && <p className="admin-status">{productMessage}</p>}

            <form className="admin-product-form" onSubmit={saveProduct}>
              <div className="admin-form-grid">
                <label>
                  Product ID
                  <input
                    value={productDraft.id}
                    onChange={(event) => setProductDraft((current) => ({ ...current, id: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Slug
                  <input
                    value={productDraft.slug}
                    onChange={(event) => setProductDraft((current) => ({ ...current, slug: event.target.value }))}
                    placeholder="aure-line-gold-hoops"
                  />
                </label>
                <label>
                  Product name
                  <input
                    value={productDraft.name}
                    onChange={(event) => setProductDraft((current) => ({
                      ...current,
                      name: event.target.value,
                      slug: current.slug ? current.slug : slugify(event.target.value),
                    }))}
                    required
                  />
                </label>
                <label>
                  Category
                  <select
                    value={productDraft.category}
                    onChange={(event) => setProductDraft((current) => ({
                      ...current,
                      category: event.target.value as ProductCategory,
                    }))}
                  >
                    {productCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Collection
                  <input
                    value={productDraft.collection}
                    onChange={(event) => setProductDraft((current) => ({ ...current, collection: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productDraft.price}
                    onChange={(event) => setProductDraft((current) => ({ ...current, price: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Stock
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productDraft.stock}
                    onChange={(event) => setProductDraft((current) => ({ ...current, stock: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Material
                  <input
                    value={productDraft.material}
                    onChange={(event) => setProductDraft((current) => ({ ...current, material: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Colors
                  <input
                    value={productDraft.colors}
                    onChange={(event) => setProductDraft((current) => ({ ...current, colors: event.target.value }))}
                    placeholder="Gold, Ivory, Black"
                    required
                  />
                </label>
                <label>
                  Occasions
                  <input
                    value={productDraft.occasion}
                    onChange={(event) => setProductDraft((current) => ({ ...current, occasion: event.target.value }))}
                    placeholder="Travel, Gift, Evening"
                    required
                  />
                </label>
                <label>
                  Rating
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={productDraft.rating}
                    onChange={(event) => setProductDraft((current) => ({ ...current, rating: event.target.value }))}
                  />
                </label>
                <label>
                  Reviews
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productDraft.reviews}
                    onChange={(event) => setProductDraft((current) => ({ ...current, reviews: event.target.value }))}
                  />
                </label>
                <label className="admin-field-wide">
                  Images
                  <textarea
                    value={productDraft.images}
                    onChange={(event) => setProductDraft((current) => ({ ...current, images: event.target.value }))}
                    placeholder="One image URL per line"
                    required
                  />
                </label>
                <label className="admin-field-wide">
                  Description
                  <textarea
                    value={productDraft.description}
                    onChange={(event) => setProductDraft((current) => ({ ...current, description: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Materials detail
                  <textarea
                    value={productDraft.detailsMaterials}
                    onChange={(event) => setProductDraft((current) => ({ ...current, detailsMaterials: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Dimensions
                  <textarea
                    value={productDraft.detailsDimensions}
                    onChange={(event) => setProductDraft((current) => ({ ...current, detailsDimensions: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Care
                  <textarea
                    value={productDraft.detailsCare}
                    onChange={(event) => setProductDraft((current) => ({ ...current, detailsCare: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Shipping
                  <textarea
                    value={productDraft.detailsShipping}
                    onChange={(event) => setProductDraft((current) => ({ ...current, detailsShipping: event.target.value }))}
                    required
                  />
                </label>
              </div>
              <div className="admin-checkboxes">
                <label><input type="checkbox" checked={productDraft.isNew} onChange={(event) => setProductDraft((current) => ({ ...current, isNew: event.target.checked }))} /> New arrival</label>
                <label><input type="checkbox" checked={productDraft.isBridalPreview} onChange={(event) => setProductDraft((current) => ({ ...current, isBridalPreview: event.target.checked }))} /> Bridal preview</label>
              </div>
              <button type="submit" disabled={isSavingProduct}>
                {isSavingProduct ? "Saving product" : "Save product"}
              </button>
            </form>
          </article>
        </section>

        <section className="admin-grid">
          <article className="admin-panel" id="orders">
            <div className="panel-heading">
              <h2>Orders</h2>
              <button type="button" onClick={readOrders} disabled={isLoadingOrders}>
                {isLoadingOrders ? "Refreshing" : "Refresh"}
              </button>
            </div>
            <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); void readOrders(); }}>
              <label>
                Status
                <select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value as "" | OrderStatus)}>
                  <option value="">All</option>
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                Customer email
                <input
                  type="email"
                  value={orderEmailFilter}
                  onChange={(event) => setOrderEmailFilter(event.target.value)}
                  placeholder="client@example.com"
                />
              </label>
              <button type="submit">Apply</button>
            </form>
            <p className="admin-status">{ordersTotal} orders in this view</p>
            <div className="order-list admin-order-list">
              {orders.map((order) => (
                <div key={order.id}>
                  <strong>{order.id.slice(0, 8)}</strong>
                  <span>{order.customer.name}</span>
                  <span>{formatMoney(order.total, order.currency)}</span>
                  <em>{order.status}</em>
                  <button type="button" onClick={() => readOrderDetail(order.id)}>Open</button>
                </div>
              ))}
            </div>
            {ordersMessage && <p className="admin-status">{ordersMessage}</p>}
          </article>

          <article className="admin-panel admin-order-detail">
            <div className="panel-heading">
              <h2>Order Detail</h2>
            </div>
            {selectedOrder ? (
              <form onSubmit={updateOrder}>
                <div className="admin-order-summary">
                  <strong>{selectedOrder.customer.name}</strong>
                  <span>{selectedOrder.customer.email}</span>
                  <span>{formatMoney(selectedOrder.total, selectedOrder.currency)}</span>
                  <span>{formatDate(selectedOrder.createdAt)}</span>
                </div>
                <p className="admin-status">{addressLine(selectedOrder.shippingAddress)}</p>
                <div className="admin-order-items">
                  {selectedOrder.items.map((item) => (
                    <span key={item.id}>
                      {item.quantity} x {item.name} ({item.color}) - {formatMoney(item.lineTotal, selectedOrder.currency)}
                    </span>
                  ))}
                </div>
                <div className="admin-form-grid admin-form-grid-compact">
                  <label>
                    Order status
                    <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value as OrderStatus)}>
                      {orderStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Payment
                    <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)}>
                      {paymentStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-field-wide">
                    Notes
                    <textarea value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} />
                  </label>
                </div>
                <button type="submit">Update order</button>
              </form>
            ) : (
              <p className="admin-empty">Open an order to manage fulfillment, payment status, and internal notes.</p>
            )}
          </article>
        </section>

        <section className="admin-grid">
          <article className="admin-panel newsletter-admin-panel" id="newsletter">
            <div className="panel-heading">
              <h2>Newsletter</h2>
              <button type="button" onClick={readNewsletterStats}><MailCheck size={16} /> Refresh</button>
            </div>
            <div className="newsletter-admin-stats">
              <span><strong>{newsletterStats?.subscribed ?? "-"}</strong> subscribed</span>
              <span><strong>{newsletterStats?.unsubscribed ?? "-"}</strong> unsubscribed</span>
              <span><strong>{newsletterStats?.campaigns ?? "-"}</strong> campaigns</span>
            </div>
            <form className="newsletter-admin-form" onSubmit={sendNewsletter}>
              <label>
                Subject
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="New SEKANAE arrivals"
                  required
                />
              </label>
              <label>
                Preview text
                <input
                  value={previewText}
                  onChange={(event) => setPreviewText(event.target.value)}
                  placeholder="A short inbox preview"
                />
              </label>
              <label>
                Email HTML
                <textarea
                  value={html}
                  onChange={(event) => setHtml(event.target.value)}
                  required
                />
              </label>
              <label>
                Plain text fallback
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
              </label>
              <button type="submit" disabled={isSendingNewsletter}>
                <Send size={16} /> {isSendingNewsletter ? "Sending" : "Send to subscribers"}
              </button>
            </form>
            {newsletterMessage && <p className="admin-status">{newsletterMessage}</p>}
            {campaignResult && (
              <p className="admin-status">
                Campaign {campaignResult.id.slice(0, 8)}: {campaignResult.sentCount}/{campaignResult.recipientCount} sent,
                {" "}{campaignResult.failedCount} failed.
              </p>
            )}
          </article>

          <article className="admin-panel" id="content">
            <h2>Content Calendar</h2>
            <div className="content-tasks">
              <label><input type="checkbox" defaultChecked /> Publish Travel Edit journal story</label>
              <label><input type="checkbox" /> Prepare Bridal Atelier waitlist email</label>
              <label><input type="checkbox" /> Update gift packaging photography</label>
            </div>
          </article>
          <article className="admin-panel" id="markets">
            <h2>Markets and Readiness</h2>
            <div className="market-list">
              {["US", "UK", "EU", "Nigeria", "UAE", "Singapore"].map((market) => (
                <span key={market}><Sparkles size={14} /> {market}</span>
              ))}
            </div>
            <p>
              Next backend phase: connect tax rules, shipping zones, payment provider events,
              and customer profile tools as order volume grows.
            </p>
          </article>
        </section>
      </section>
    </div>
  );
}
