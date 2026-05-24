import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardList,
  Edit3,
  Eye,
  Globe2,
  KeyRound,
  Layers3,
  LifeBuoy,
  MailCheck,
  PackagePlus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { getProducts } from "../api/client";
import { getApiBaseUrl } from "../api/config";
import { products as fallbackProducts, type Collection, type CurrencyCode, type Product, type ProductCategory } from "../data/catalog";
import { formatMoney } from "../utils/money";

const apiBaseUrl = getApiBaseUrl();
const adminTokenStorageKey = "sekanae_admin_token";
const productsPerPage = 8;

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
const conciergeStatuses = ["open", "in_progress", "resolved", "closed"] as const;
const replyStatuses = ["not_replied", "reply_needed", "replied"] as const;
const currencyOptions: CurrencyCode[] = ["USD", "GBP", "EUR", "NGN", "AED"];

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

type CustomerProfile = {
  email: string;
  name?: string;
  phone?: string;
  newsletterStatus?: "subscribed" | "unsubscribed";
  newsletterSource?: string;
  orderCount: number;
  totalSpend: number;
  currency?: CurrencyCode;
  lastOrderAt?: string;
  firstSeenAt?: string;
  orders?: Order[];
};

type DashboardData = {
  metrics: {
    revenue: number;
    orders: number;
    customers: number;
    lowStock: number;
    newsletterSubscribers: number;
  };
  recentOrders: Array<{
    id: string;
    customerName: string;
    customerEmail: string;
    currency: CurrencyCode;
    total: number;
    status: string;
    createdAt: string;
  }>;
  lowInventory: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    stock: number;
  }>;
};

type CollectionDraft = Collection & {
  sortOrder: string;
};

type ConciergeStatus = typeof conciergeStatuses[number];
type ReplyStatus = typeof replyStatuses[number];

type ConciergeRequest = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  message: string;
  source?: string;
  status: ConciergeStatus;
  replyStatus: ReplyStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
};

type StoreSettings = {
  defaultCurrency: CurrencyCode;
  defaultMarketCountry: string;
  defaultShippingAmount: number;
  vatRate: number;
  vatIncluded: boolean;
  storeContactEmail?: string;
  apiPublicUrl: string;
  webOrigin: string;
  updatedAt?: string;
  updatedBy?: string;
};

type SettingsHealth = {
  database: boolean;
  stripe: boolean;
  email: boolean;
  adminEmail: boolean;
  apiPublicUrl: string;
  webOrigin: string;
};

type AuditLog = {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
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

function createCollectionDraft(): CollectionDraft {
  return {
    id: `collection-${Date.now().toString(36)}`,
    title: "",
    description: "",
    image: "",
    cta: "",
    sortOrder: "0",
  };
}

function collectionToDraft(collection: Collection, sortOrder = 0): CollectionDraft {
  return {
    ...collection,
    sortOrder: String(sortOrder),
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

function getAdminBase(pathname: string) {
  return pathname.startsWith("/admin") ? "/admin" : "/sekanae-studio";
}

function getRoutePath(pathname: string, basePath: string) {
  return pathname.slice(basePath.length).replace(/^\/+/, "") || "dashboard";
}

function getProductRoutePart(routePath: string) {
  const parts = routePath.split("/");
  return parts[0] === "products" ? parts : [];
}

function getPageTitle(routePath: string) {
  if (routePath === "dashboard") return "Dashboard";
  if (routePath === "products") return "Products";
  if (routePath === "products/new") return "New Product";
  if (routePath.startsWith("products/") && routePath.endsWith("/edit")) return "Edit Product";
  if (routePath.startsWith("products/")) return "Product Detail";
  if (routePath === "orders") return "Orders";
  if (routePath === "customers") return "Customers";
  if (routePath.startsWith("customers/")) return "Customer Detail";
  if (routePath === "collections") return "Collections";
  if (routePath === "concierge") return "Concierge";
  if (routePath === "newsletter") return "Newsletter";
  if (routePath === "content") return "Content";
  if (routePath === "markets") return "Markets";
  if (routePath === "settings") return "Settings";
  if (routePath === "audit") return "Audit Log";
  return "Dashboard";
}

export function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const adminBase = getAdminBase(location.pathname);
  const routePath = getRoutePath(location.pathname, adminBase);
  const productRouteParts = getProductRoutePart(routePath);
  const routeProductId = productRouteParts[1];
  const routeCustomerEmail = routePath.startsWith("customers/")
    ? decodeURIComponent(routePath.replace("customers/", ""))
    : undefined;

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
  const [productPage, setProductPage] = useState(1);
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
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersMessage, setCustomersMessage] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardMessage, setDashboardMessage] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionDraft, setCollectionDraft] = useState<CollectionDraft>(() => createCollectionDraft());
  const [collectionMessage, setCollectionMessage] = useState<string | null>(null);
  const [conciergeRequests, setConciergeRequests] = useState<ConciergeRequest[]>([]);
  const [conciergeFilter, setConciergeFilter] = useState<"" | ConciergeStatus>("");
  const [conciergeMessage, setConciergeMessage] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<StoreSettings | null>(null);
  const [settingsHealth, setSettingsHealth] = useState<SettingsHealth | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  const selectedProduct = useMemo(() => {
    if (!routeProductId) return undefined;
    return adminProducts.find((product) => product.id === routeProductId || product.slug === routeProductId);
  }, [adminProducts, routeProductId]);

  const productPageCount = Math.max(1, Math.ceil(adminProducts.length / productsPerPage));
  const customerPageCount = Math.max(1, Math.ceil(customersTotal / productsPerPage));
  const visibleProducts = useMemo(() => {
    const firstProduct = (productPage - 1) * productsPerPage;
    return adminProducts.slice(firstProduct, firstProduct + productsPerPage);
  }, [adminProducts, productPage]);

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
    void readCustomers();
    void readDashboard();
    void readCollections();
    void readConcierge();
    void readSettings();
    void readAudit();
    void readNewsletterStats();
    // Dashboard data should hydrate only after auth changes; filters refresh through Apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, adminToken]);

  useEffect(() => {
    if (productPage > productPageCount) {
      setProductPage(productPageCount);
    }
  }, [productPage, productPageCount]);

  useEffect(() => {
    if (customerPage > customerPageCount) {
      setCustomerPage(customerPageCount);
    }
  }, [customerPage, customerPageCount]);

  useEffect(() => {
    if (routePath === "products/new") {
      setProductDraft(createProductDraft());
      setProductMessage(null);
      return;
    }

    if (routePath.startsWith("products/") && routePath.endsWith("/edit") && selectedProduct) {
      setProductDraft(productToDraft(selectedProduct));
      setProductMessage(null);
    }
  }, [routePath, selectedProduct]);

  useEffect(() => {
    if (!isAuthenticated || !adminToken || !routeCustomerEmail) {
      return;
    }

    void readCustomerDetail(routeCustomerEmail);
    // Customer detail should refresh when the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, adminToken, routeCustomerEmail]);

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
    setDashboardData(null);
    setSettingsDraft(null);
    setSettingsHealth(null);
    setAuditLogs([]);
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

  async function readDashboard() {
    if (!adminToken) {
      return;
    }

    try {
      const payload = await readAdmin<DashboardData>("/api/admin/dashboard");
      setDashboardData(payload.data);
      setDashboardMessage(null);
    } catch (error) {
      setDashboardData(null);
      setDashboardMessage(error instanceof Error ? error.message : "Dashboard metrics are unavailable.");
    }
  }

  async function readCollections() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/collections`);
      const payload = await response.json() as ApiPayload<Collection[]>;

      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Collections are unavailable.");
      }

      setCollections(payload.data);
      setCollectionMessage(null);
    } catch (error) {
      setCollections([]);
      setCollectionMessage(error instanceof Error ? error.message : "Collections are unavailable.");
    }
  }

  async function saveCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCollectionMessage(null);

    try {
      const payload = await readAdmin<Collection>("/api/admin/collections", {
        method: "POST",
        body: JSON.stringify({
          id: collectionDraft.id.trim(),
          title: collectionDraft.title.trim(),
          description: collectionDraft.description.trim(),
          image: collectionDraft.image.trim(),
          cta: collectionDraft.cta.trim(),
          sortOrder: Number(collectionDraft.sortOrder),
        }),
      });

      setCollectionMessage(`${payload.data.title} has been saved.`);
      setCollectionDraft(collectionToDraft(payload.data));
      await readCollections();
      await readAudit();
    } catch (error) {
      setCollectionMessage(error instanceof Error ? error.message : "Collection save failed.");
    }
  }

  async function archiveCollection(collectionId: string) {
    if (!window.confirm("Archive this collection?")) {
      return;
    }

    try {
      await readAdmin<{ archived: boolean }>(`/api/admin/collections/${encodeURIComponent(collectionId)}`, {
        method: "DELETE",
      });
      setCollectionMessage("Collection archived.");
      setCollectionDraft(createCollectionDraft());
      await readCollections();
      await readAudit();
    } catch (error) {
      setCollectionMessage(error instanceof Error ? error.message : "Collection archive failed.");
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
      await readDashboard();
      await readAudit();
      navigate(`${adminBase}/products/${encodeURIComponent(payload.data.id)}`);
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
      await readDashboard();
      await readAudit();
      if (routePath.startsWith("products/") && routePath !== "products") {
        navigate(`${adminBase}/products`);
      }
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
      await readDashboard();
      await readAudit();
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

  async function readCustomers(nextPage = customerPage) {
    if (!adminToken) {
      return;
    }

    setCustomersMessage(null);
    const query = new URLSearchParams({
      limit: String(productsPerPage),
      offset: String((nextPage - 1) * productsPerPage),
    });

    if (customerSearch.trim()) {
      query.set("q", customerSearch.trim());
    }

    try {
      const payload = await readAdmin<CustomerProfile[]>(`/api/admin/customers?${query.toString()}`);
      setCustomers(payload.data);
      setCustomersTotal(payload.meta?.total ?? payload.data.length);

      if (!payload.data.length) {
        setCustomersMessage("No customers match this view yet.");
      }
    } catch (error) {
      setCustomers([]);
      setCustomersTotal(0);
      setCustomersMessage(error instanceof Error ? error.message : "Customers are unavailable.");
    }
  }

  async function readCustomerDetail(email: string) {
    try {
      const payload = await readAdmin<CustomerProfile>(`/api/admin/customers/${encodeURIComponent(email)}`);
      setSelectedCustomer(payload.data);
      setCustomersMessage(null);
    } catch (error) {
      setSelectedCustomer(null);
      setCustomersMessage(error instanceof Error ? error.message : "Customer detail is unavailable.");
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
      await readDashboard();
      await readAudit();
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

  async function readConcierge() {
    if (!adminToken) {
      return;
    }

    const query = new URLSearchParams({ limit: "80" });

    if (conciergeFilter) {
      query.set("status", conciergeFilter);
    }

    try {
      const payload = await readAdmin<ConciergeRequest[]>(`/api/admin/concierge?${query.toString()}`);
      setConciergeRequests(payload.data);
      setConciergeMessage(payload.data.length ? null : "No concierge requests match this view yet.");
    } catch (error) {
      setConciergeRequests([]);
      setConciergeMessage(error instanceof Error ? error.message : "Concierge requests are unavailable.");
    }
  }

  async function updateConciergeRequest(requestId: string, patch: Partial<Pick<ConciergeRequest, "status" | "replyStatus" | "adminNotes">>) {
    try {
      await readAdmin<ConciergeRequest>(`/api/admin/concierge/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setConciergeMessage("Concierge request updated.");
      await readConcierge();
      await readAudit();
    } catch (error) {
      setConciergeMessage(error instanceof Error ? error.message : "Concierge update failed.");
    }
  }

  async function readSettings() {
    if (!adminToken) {
      return;
    }

    try {
      const [settingsPayload, healthPayload] = await Promise.all([
        readAdmin<StoreSettings>("/api/admin/settings"),
        readAdmin<SettingsHealth>("/api/admin/settings/health"),
      ]);
      setSettingsDraft(settingsPayload.data);
      setSettingsHealth(healthPayload.data);
      setSettingsMessage(null);
    } catch (error) {
      setSettingsDraft(null);
      setSettingsHealth(null);
      setSettingsMessage(error instanceof Error ? error.message : "Settings are unavailable.");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settingsDraft) {
      return;
    }

    try {
      const payload = await readAdmin<StoreSettings>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...settingsDraft,
          defaultMarketCountry: settingsDraft.defaultMarketCountry.toUpperCase(),
          defaultShippingAmount: Number(settingsDraft.defaultShippingAmount),
          vatRate: Number(settingsDraft.vatRate),
          storeContactEmail: settingsDraft.storeContactEmail || undefined,
        }),
      });
      setSettingsDraft(payload.data);
      setSettingsMessage("Store settings saved.");
      await readSettings();
      await readAudit();
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Settings save failed.");
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setSecurityMessage("New password confirmation does not match.");
      return;
    }

    try {
      await readAdmin<{ changed: boolean }>("/api/admin/security/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSecurityMessage("Admin password changed.");
      await readAudit();
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : "Password change failed.");
    }
  }

  async function readAudit() {
    if (!adminToken) {
      return;
    }

    try {
      const payload = await readAdmin<AuditLog[]>("/api/admin/audit?limit=80");
      setAuditLogs(payload.data);
      setAuditMessage(payload.data.length ? null : "No audit events have been recorded yet.");
    } catch (error) {
      setAuditLogs([]);
      setAuditMessage(error instanceof Error ? error.message : "Audit logs are unavailable.");
    }
  }

  function renderDashboard() {
    const metrics = dashboardData?.metrics;
    const dashboardMetrics = [
      {
        label: "Revenue",
        value: metrics ? formatMoney(metrics.revenue, "USD") : "-",
        note: "Confirmed order value",
      },
      {
        label: "Orders",
        value: String(metrics?.orders ?? "-"),
        note: "All-time order count",
      },
      {
        label: "Customers",
        value: String(metrics?.customers ?? "-"),
        note: "Orders plus newsletter",
      },
      {
        label: "Low Stock",
        value: String(metrics?.lowStock ?? "-"),
        note: "Inventory at 5 or below",
      },
      {
        label: "Subscribers",
        value: String(metrics?.newsletterSubscribers ?? "-"),
        note: "Newsletter-ready audience",
      },
    ];

    return (
      <>
        <section className="admin-metrics">
          {dashboardMetrics.map((metric) => (
            <article key={metric.label}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.note}</span>
            </article>
          ))}
        </section>
        {dashboardMessage && <p className="admin-status">{dashboardMessage}</p>}
        <section className="admin-dashboard-widgets">
          <article className="admin-panel">
            <div className="panel-heading">
              <h2>Recent Orders</h2>
              <Link className="admin-button-link" to={`${adminBase}/orders`}>Open orders</Link>
            </div>
            <div className="admin-widget-list">
              {(dashboardData?.recentOrders ?? []).map((order) => (
                <button key={order.id} type="button" onClick={() => {
                  void readOrderDetail(order.id);
                  navigate(`${adminBase}/orders`);
                }}>
                  <span>
                    <strong>{order.customerName}</strong>
                    <small>{order.customerEmail}</small>
                  </span>
                  <span>{formatMoney(order.total, order.currency)}</span>
                  <em>{order.status}</em>
                </button>
              ))}
              {!dashboardData?.recentOrders.length && <p className="admin-empty">No orders yet.</p>}
            </div>
          </article>
          <article className="admin-panel">
            <div className="panel-heading">
              <h2>Low Inventory</h2>
              <Link className="admin-button-link" to={`${adminBase}/products`}>Open products</Link>
            </div>
            <div className="admin-widget-list admin-inventory-watch">
              {(dashboardData?.lowInventory ?? []).map((product) => (
                <Link key={product.id} to={`${adminBase}/products/${encodeURIComponent(product.id)}`}>
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.category}</small>
                  </span>
                  <em>{product.stock} left</em>
                </Link>
              ))}
              {!dashboardData?.lowInventory.length && <p className="admin-empty">Inventory looks healthy.</p>}
            </div>
          </article>
          <article className="admin-panel">
            <div className="panel-heading">
              <h2>Operations</h2>
              <button type="button" onClick={() => { void readDashboard(); void readAudit(); }}>
                <Activity size={16} /> Refresh
              </button>
            </div>
            <div className="admin-ops-grid">
              <Link to={`${adminBase}/collections`}><Layers3 size={18} /> Collections</Link>
              <Link to={`${adminBase}/concierge`}><LifeBuoy size={18} /> Concierge</Link>
              <Link to={`${adminBase}/customers`}><Users size={18} /> Customers</Link>
              <Link to={`${adminBase}/settings`}><ShieldCheck size={18} /> Settings</Link>
            </div>
          </article>
        </section>
      </>
    );
  }

  function renderProductsList() {
    return (
      <section className="admin-grid admin-grid-wide">
        <article className="admin-panel admin-panel-wide">
          <div className="panel-heading">
            <div>
              <h2>Product Catalog</h2>
              <p className="admin-status admin-status-tight">
                Showing {visibleProducts.length} of {adminProducts.length} products
              </p>
            </div>
            <Link className="admin-button-link" to={`${adminBase}/products/new`}>
              <PackagePlus size={16} /> New product
            </Link>
          </div>
          <div className="admin-table admin-product-table">
            <div className="admin-table-head">
              <span>Product</span><span>Category</span><span>Inventory</span><span>Actions</span>
            </div>
            {visibleProducts.map((product) => (
              <div className="admin-row" key={product.id}>
                <Link to={`${adminBase}/products/${encodeURIComponent(product.id)}`}>
                  <img src={product.images[0]} alt="" /> {product.name}
                </Link>
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
                  <Link className="admin-inline-button" to={`${adminBase}/products/${encodeURIComponent(product.id)}`}>
                    <Eye size={14} /> View
                  </Link>
                  <Link className="admin-inline-button" to={`${adminBase}/products/${encodeURIComponent(product.id)}/edit`}>
                    Edit
                  </Link>
                  <button className="admin-danger" type="button" onClick={() => archiveProduct(product.id)}>
                    <Trash2 size={14} /> Archive
                  </button>
                </span>
              </div>
            ))}
          </div>
          <div className="admin-pagination">
            <button type="button" disabled={productPage === 1} onClick={() => setProductPage((page) => Math.max(1, page - 1))}>
              Previous
            </button>
            <span>Page {productPage} of {productPageCount}</span>
            <button type="button" disabled={productPage === productPageCount} onClick={() => setProductPage((page) => Math.min(productPageCount, page + 1))}>
              Next
            </button>
          </div>
          {productMessage && <p className="admin-status">{productMessage}</p>}
        </article>
      </section>
    );
  }

  function renderProductDetail() {
    if (!selectedProduct) {
      return (
        <section className="admin-panel">
          <h2>Product not found</h2>
          <p className="admin-empty">This product is not available in the loaded catalog.</p>
          <Link className="admin-button-link" to={`${adminBase}/products`}>Back to products</Link>
        </section>
      );
    }

    return (
      <section className="admin-panel admin-product-detail">
        <div className="panel-heading">
          <div>
            <h2>{selectedProduct.name}</h2>
            <p className="admin-status admin-status-tight">{selectedProduct.collection} / {selectedProduct.category}</p>
          </div>
          <div className="admin-row-actions">
            <Link className="admin-inline-button" to={`${adminBase}/products/${encodeURIComponent(selectedProduct.id)}/edit`}>Edit</Link>
            <button className="admin-danger" type="button" onClick={() => archiveProduct(selectedProduct.id)}>
              <Trash2 size={14} /> Archive
            </button>
          </div>
        </div>
        <div className="admin-product-detail-grid">
          <img src={selectedProduct.images[0]} alt={selectedProduct.name} />
          <div className="admin-product-facts">
            <span><strong>Price</strong>{formatMoney(selectedProduct.price, "USD")}</span>
            <span><strong>Stock</strong>{selectedProduct.stock}</span>
            <span><strong>Material</strong>{selectedProduct.material}</span>
            <span><strong>Rating</strong>{selectedProduct.rating} / 5 ({selectedProduct.reviews} reviews)</span>
            <span><strong>Colors</strong>{selectedProduct.colors.join(", ")}</span>
            <span><strong>Occasions</strong>{selectedProduct.occasion.join(", ")}</span>
          </div>
        </div>
        <div className="admin-product-copy">
          <p>{selectedProduct.description}</p>
          <dl>
            <div><dt>Materials</dt><dd>{selectedProduct.details.materials}</dd></div>
            <div><dt>Dimensions</dt><dd>{selectedProduct.details.dimensions}</dd></div>
            <div><dt>Care</dt><dd>{selectedProduct.details.care}</dd></div>
            <div><dt>Shipping</dt><dd>{selectedProduct.details.shipping}</dd></div>
          </dl>
        </div>
        {productMessage && <p className="admin-status">{productMessage}</p>}
      </section>
    );
  }

  function renderProductForm(formTitle: string) {
    return (
      <section className="admin-panel admin-panel-wide">
        <div className="panel-heading">
          <h2>{formTitle}</h2>
          <Link className="admin-button-link" to={`${adminBase}/products`}>Back to products</Link>
        </div>
        <form className="admin-product-form admin-product-form-standalone" onSubmit={saveProduct}>
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
        {productMessage && <p className="admin-status">{productMessage}</p>}
      </section>
    );
  }

  function renderOrders() {
    return (
      <section className="admin-grid">
        <article className="admin-panel">
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
    );
  }

  function renderCustomers() {
    return (
      <section className="admin-panel admin-panel-wide">
        <div className="panel-heading">
          <div>
            <h2>Customers</h2>
            <p className="admin-status admin-status-tight">
              Showing {customers.length} of {customersTotal} customer records
            </p>
          </div>
        </div>
        <form className="admin-filters" onSubmit={(event) => {
          event.preventDefault();
          setCustomerPage(1);
          void readCustomers(1);
        }}>
          <label>
            Search
            <input
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Name, email, or phone"
            />
          </label>
          <button type="submit">Apply</button>
        </form>
        <div className="admin-table admin-customer-table">
          <div className="admin-table-head">
            <span>Customer</span><span>Orders</span><span>Total Spend</span><span>Status</span><span>Actions</span>
          </div>
          {customers.map((customer) => (
            <div className="admin-row" key={customer.email}>
              <Link to={`${adminBase}/customers/${encodeURIComponent(customer.email)}`}>
                <span className="admin-avatar">{(customer.name ?? customer.email).slice(0, 1).toUpperCase()}</span>
                <span>
                  <strong>{customer.name ?? "Unknown customer"}</strong>
                  <small>{customer.email}</small>
                </span>
              </Link>
              <span>{customer.orderCount}</span>
              <span>{customer.currency ? formatMoney(customer.totalSpend, customer.currency) : "-"}</span>
              <span>{customer.newsletterStatus ?? "No newsletter"}</span>
              <span className="admin-row-actions">
                <Link className="admin-inline-button" to={`${adminBase}/customers/${encodeURIComponent(customer.email)}`}>
                  <Eye size={14} /> View
                </Link>
              </span>
            </div>
          ))}
        </div>
        <div className="admin-pagination">
          <button type="button" disabled={customerPage === 1} onClick={() => {
            const nextPage = Math.max(1, customerPage - 1);
            setCustomerPage(nextPage);
            void readCustomers(nextPage);
          }}>
            Previous
          </button>
          <span>Page {customerPage} of {customerPageCount}</span>
          <button type="button" disabled={customerPage === customerPageCount} onClick={() => {
            const nextPage = Math.min(customerPageCount, customerPage + 1);
            setCustomerPage(nextPage);
            void readCustomers(nextPage);
          }}>
            Next
          </button>
        </div>
        {customersMessage && <p className="admin-status">{customersMessage}</p>}
      </section>
    );
  }

  function renderCustomerDetail() {
    if (!selectedCustomer) {
      return (
        <section className="admin-panel">
          <h2>Customer not found</h2>
          <p className="admin-empty">{customersMessage ?? "This customer is not available."}</p>
          <Link className="admin-button-link" to={`${adminBase}/customers`}>Back to customers</Link>
        </section>
      );
    }

    return (
      <section className="admin-grid">
        <article className="admin-panel admin-customer-detail">
          <div className="panel-heading">
            <div>
              <h2>{selectedCustomer.name ?? "Customer"}</h2>
              <p className="admin-status admin-status-tight">{selectedCustomer.email}</p>
            </div>
            <Link className="admin-button-link" to={`${adminBase}/customers`}>Back to customers</Link>
          </div>
          <div className="admin-product-facts">
            <span><strong>Orders</strong>{selectedCustomer.orderCount}</span>
            <span><strong>Total spend</strong>{selectedCustomer.currency ? formatMoney(selectedCustomer.totalSpend, selectedCustomer.currency) : "-"}</span>
            <span><strong>Newsletter</strong>{selectedCustomer.newsletterStatus ?? "No newsletter"}</span>
            <span><strong>Source</strong>{selectedCustomer.newsletterSource ?? "Order/customer record"}</span>
            <span><strong>Phone</strong>{selectedCustomer.phone ?? "-"}</span>
            <span><strong>Last order</strong>{selectedCustomer.lastOrderAt ? formatDate(selectedCustomer.lastOrderAt) : "-"}</span>
          </div>
        </article>
        <article className="admin-panel">
          <div className="panel-heading">
            <h2>Order History</h2>
          </div>
          <div className="order-list admin-order-list">
            {(selectedCustomer.orders ?? []).map((order) => (
              <div key={order.id}>
                <strong>{order.id.slice(0, 8)}</strong>
                <span>{formatDate(order.createdAt)}</span>
                <span>{formatMoney(order.total, order.currency)}</span>
                <em>{order.status}</em>
                <button type="button" onClick={() => {
                  setSelectedOrder(order);
                  setOrderStatus(order.status);
                  setPaymentStatus(order.paymentStatus);
                  setOrderNotes(order.notes ?? "");
                  navigate(`${adminBase}/orders`);
                }}>
                  Open
                </button>
              </div>
            ))}
          </div>
          {!selectedCustomer.orders?.length && <p className="admin-empty">No orders for this customer yet.</p>}
        </article>
      </section>
    );
  }

  function renderNewsletter() {
    return (
      <article className="admin-panel newsletter-admin-panel">
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
    );
  }

  function renderCollections() {
    return (
      <section className="admin-grid admin-grid-wide">
        <article className="admin-panel">
          <div className="panel-heading">
            <div>
              <h2>Collections Manager</h2>
              <p className="admin-status admin-status-tight">Create landing groups, edit imagery, and control display order.</p>
            </div>
            <button type="button" onClick={() => setCollectionDraft(createCollectionDraft())}>
              <PackagePlus size={16} /> New collection
            </button>
          </div>
          <form className="admin-product-form admin-product-form-standalone" onSubmit={saveCollection}>
            <div className="admin-form-grid">
              <label>
                Collection ID
                <input
                  value={collectionDraft.id}
                  onChange={(event) => setCollectionDraft((current) => ({ ...current, id: event.target.value }))}
                  required
                />
              </label>
              <label>
                Title
                <input
                  value={collectionDraft.title}
                  onChange={(event) => setCollectionDraft((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </label>
              <label>
                CTA
                <input
                  value={collectionDraft.cta}
                  onChange={(event) => setCollectionDraft((current) => ({ ...current, cta: event.target.value }))}
                  required
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={collectionDraft.sortOrder}
                  onChange={(event) => setCollectionDraft((current) => ({ ...current, sortOrder: event.target.value }))}
                />
              </label>
              <label className="admin-field-wide">
                Image URL
                <input
                  value={collectionDraft.image}
                  onChange={(event) => setCollectionDraft((current) => ({ ...current, image: event.target.value }))}
                  required
                />
              </label>
              <label className="admin-field-wide">
                Description
                <textarea
                  value={collectionDraft.description}
                  onChange={(event) => setCollectionDraft((current) => ({ ...current, description: event.target.value }))}
                  required
                />
              </label>
            </div>
            <button type="submit">Save collection</button>
          </form>
          {collectionMessage && <p className="admin-status">{collectionMessage}</p>}
        </article>

        <article className="admin-panel admin-panel-wide">
          <div className="panel-heading">
            <h2>Live Collections</h2>
            <button type="button" onClick={readCollections}>Refresh</button>
          </div>
          <div className="admin-collection-grid">
            {collections.map((collection, index) => (
              <article key={collection.id}>
                <img src={collection.image} alt="" />
                <div>
                  <strong>{collection.title}</strong>
                  <p>{collection.description}</p>
                  <small>{collection.cta}</small>
                </div>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => setCollectionDraft(collectionToDraft(collection, index))}>Edit</button>
                  <button className="admin-danger" type="button" onClick={() => archiveCollection(collection.id)}>
                    <Trash2 size={14} /> Archive
                  </button>
                </div>
              </article>
            ))}
            {!collections.length && <p className="admin-empty">No collections are available yet.</p>}
          </div>
        </article>
      </section>
    );
  }

  function renderConcierge() {
    return (
      <section className="admin-grid admin-grid-wide">
        <article className="admin-panel admin-panel-wide">
          <div className="panel-heading">
            <div>
              <h2>Concierge Requests</h2>
              <p className="admin-status admin-status-tight">Track contact form messages, replies, internal notes, and resolution state.</p>
            </div>
            <button type="button" onClick={readConcierge}>Refresh</button>
          </div>
          <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); void readConcierge(); }}>
            <label>
              Status
              <select value={conciergeFilter} onChange={(event) => setConciergeFilter(event.target.value as "" | ConciergeStatus)}>
                <option value="">All</option>
                {conciergeStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <button type="submit">Apply</button>
          </form>
          <div className="admin-request-list">
            {conciergeRequests.map((request) => (
              <article className="admin-request-card" key={request.id}>
                <div>
                  <strong>{request.name}</strong>
                  <span>{request.email}{request.phone ? ` / ${request.phone}` : ""}</span>
                  <small>{formatDate(request.createdAt)} / {request.source ?? "Website form"}</small>
                </div>
                <div>
                  <h3>{request.topic}</h3>
                  <p>{request.message}</p>
                </div>
                <label>
                  Status
                  <select
                    value={request.status}
                    onChange={(event) => updateConciergeRequest(request.id, { status: event.target.value as ConciergeStatus })}
                  >
                    {conciergeStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Reply
                  <select
                    value={request.replyStatus}
                    onChange={(event) => updateConciergeRequest(request.id, { replyStatus: event.target.value as ReplyStatus })}
                  >
                    {replyStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field-wide">
                  Internal notes
                  <textarea
                    defaultValue={request.adminNotes ?? ""}
                    onBlur={(event) => {
                      if (event.currentTarget.value !== (request.adminNotes ?? "")) {
                        void updateConciergeRequest(request.id, { adminNotes: event.currentTarget.value });
                      }
                    }}
                  />
                </label>
              </article>
            ))}
          </div>
          {conciergeMessage && <p className="admin-status">{conciergeMessage}</p>}
        </article>
      </section>
    );
  }

  function renderAuditLog(limit?: number) {
    const visibleLogs = typeof limit === "number" ? auditLogs.slice(0, limit) : auditLogs;

    return (
      <div className="admin-audit-list">
        {visibleLogs.map((log) => (
          <article key={log.id}>
            <span>{formatDate(log.createdAt)}</span>
            <strong>{log.summary}</strong>
            <small>{log.actorEmail} / {log.entityType}{log.entityId ? ` / ${log.entityId}` : ""}</small>
          </article>
        ))}
        {!visibleLogs.length && <p className="admin-empty">{auditMessage ?? "No audit events have been recorded yet."}</p>}
      </div>
    );
  }

  function renderSettings() {
    return (
      <section className="admin-grid admin-grid-wide">
        <article className="admin-panel">
          <div className="panel-heading">
            <div>
              <h2>Store Settings</h2>
              <p className="admin-status admin-status-tight">Defaults used by checkout, tax, shipping, markets, and operational emails.</p>
            </div>
            <button type="button" onClick={readSettings}>Refresh</button>
          </div>
          {settingsDraft ? (
            <form className="admin-product-form admin-product-form-standalone" onSubmit={saveSettings}>
              <div className="admin-form-grid">
                <label>
                  Currency
                  <select
                    value={settingsDraft.defaultCurrency}
                    onChange={(event) => setSettingsDraft((current) => current ? ({ ...current, defaultCurrency: event.target.value as CurrencyCode }) : current)}
                  >
                    {currencyOptions.map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Market country
                  <input
                    value={settingsDraft.defaultMarketCountry}
                    maxLength={2}
                    onChange={(event) => setSettingsDraft((current) => current ? ({ ...current, defaultMarketCountry: event.target.value.toUpperCase() }) : current)}
                  />
                </label>
                <label>
                  Shipping amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settingsDraft.defaultShippingAmount}
                    onChange={(event) => setSettingsDraft((current) => current ? ({ ...current, defaultShippingAmount: Number(event.target.value) }) : current)}
                  />
                </label>
                <label>
                  VAT rate
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settingsDraft.vatRate}
                    onChange={(event) => setSettingsDraft((current) => current ? ({ ...current, vatRate: Number(event.target.value) }) : current)}
                  />
                </label>
                <label className="admin-field-wide">
                  Store contact email
                  <input
                    type="email"
                    value={settingsDraft.storeContactEmail ?? ""}
                    onChange={(event) => setSettingsDraft((current) => current ? ({ ...current, storeContactEmail: event.target.value }) : current)}
                  />
                </label>
                <label className="admin-field-wide">
                  API public URL
                  <input
                    value={settingsDraft.apiPublicUrl}
                    onChange={(event) => setSettingsDraft((current) => current ? ({ ...current, apiPublicUrl: event.target.value }) : current)}
                  />
                </label>
                <label className="admin-field-wide">
                  Web origin
                  <input
                    value={settingsDraft.webOrigin}
                    onChange={(event) => setSettingsDraft((current) => current ? ({ ...current, webOrigin: event.target.value }) : current)}
                  />
                </label>
              </div>
              <div className="admin-checkboxes">
                <label>
                  <input
                    type="checkbox"
                    checked={settingsDraft.vatIncluded}
                    onChange={(event) => setSettingsDraft((current) => current ? ({ ...current, vatIncluded: event.target.checked }) : current)}
                  />
                  Prices include VAT
                </label>
              </div>
              <button type="submit">Save settings</button>
            </form>
          ) : (
            <p className="admin-empty">Settings are loading.</p>
          )}
          {settingsMessage && <p className="admin-status">{settingsMessage}</p>}
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2>Environment Health</h2>
          </div>
          <div className="admin-health-grid">
            {[
              ["Database", settingsHealth?.database],
              ["Stripe", settingsHealth?.stripe],
              ["Email", settingsHealth?.email],
              ["Admin Email", settingsHealth?.adminEmail],
            ].map(([label, healthy]) => (
              <span key={String(label)} className={healthy ? "is-healthy" : "is-missing"}>
                <strong>{label}</strong>{healthy ? "Ready" : "Missing"}
              </span>
            ))}
          </div>
          {settingsHealth && (
            <p className="admin-status">
              API: {settingsHealth.apiPublicUrl}<br />
              Web: {settingsHealth.webOrigin}
            </p>
          )}
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2>Admin Security</h2>
          </div>
          <form className="admin-product-form admin-product-form-standalone" onSubmit={changePassword}>
            <div className="admin-form-grid admin-form-grid-compact">
              <label>
                Current password
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                  required
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                  minLength={12}
                  required
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  minLength={12}
                  required
                />
              </label>
            </div>
            <button type="submit"><KeyRound size={16} /> Change password</button>
          </form>
          {securityMessage && <p className="admin-status">{securityMessage}</p>}
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2>Recent Audit</h2>
            <Link className="admin-button-link" to={`${adminBase}/audit`}>Open audit</Link>
          </div>
          {renderAuditLog(6)}
        </article>
      </section>
    );
  }

  function renderAudit() {
    return (
      <section className="admin-panel admin-panel-wide">
        <div className="panel-heading">
          <div>
            <h2>Audit Log</h2>
            <p className="admin-status admin-status-tight">Product, order, collection, concierge, settings, and password changes.</p>
          </div>
          <button type="button" onClick={readAudit}>Refresh</button>
        </div>
        {renderAuditLog()}
      </section>
    );
  }

  function renderContent() {
    return (
      <section className="admin-grid">
        <article className="admin-panel">
          <h2>Content Calendar</h2>
          <div className="content-tasks">
            <label><input type="checkbox" defaultChecked /> Publish Travel Edit journal story</label>
            <label><input type="checkbox" /> Prepare Bridal Atelier waitlist email</label>
            <label><input type="checkbox" /> Update gift packaging photography</label>
          </div>
        </article>
      </section>
    );
  }

  function renderMarkets() {
    return (
      <article className="admin-panel">
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
    );
  }

  function renderRoute() {
    if (routePath === "dashboard") return renderDashboard();
    if (routePath === "products") return renderProductsList();
    if (routePath === "products/new") return renderProductForm("New Product");
    if (routePath.startsWith("products/") && routePath.endsWith("/edit")) return renderProductForm("Edit Product");
    if (routePath.startsWith("products/")) return renderProductDetail();
    if (routePath === "orders") return renderOrders();
    if (routePath === "customers") return renderCustomers();
    if (routePath.startsWith("customers/")) return renderCustomerDetail();
    if (routePath === "collections") return renderCollections();
    if (routePath === "concierge") return renderConcierge();
    if (routePath === "newsletter") return renderNewsletter();
    if (routePath === "content") return renderContent();
    if (routePath === "markets") return renderMarkets();
    if (routePath === "settings") return renderSettings();
    if (routePath === "audit") return renderAudit();
    return renderDashboard();
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
        <Link className="admin-brand" to={adminBase}>SEKANAE</Link>
        <NavLink to={adminBase} end><BarChart3 size={18} /> Dashboard</NavLink>
        <NavLink to={`${adminBase}/products`}><Boxes size={18} /> Products</NavLink>
        <NavLink to={`${adminBase}/collections`}><Layers3 size={18} /> Collections</NavLink>
        <NavLink to={`${adminBase}/orders`}><ClipboardList size={18} /> Orders</NavLink>
        <NavLink to={`${adminBase}/customers`}><Users size={18} /> Customers</NavLink>
        <NavLink to={`${adminBase}/concierge`}><LifeBuoy size={18} /> Concierge</NavLink>
        <NavLink to={`${adminBase}/newsletter`}><MailCheck size={18} /> Newsletter</NavLink>
        <NavLink to={`${adminBase}/content`}><Edit3 size={18} /> Content</NavLink>
        <NavLink to={`${adminBase}/markets`}><Globe2 size={18} /> Markets</NavLink>
        <NavLink to={`${adminBase}/settings`}><Settings size={18} /> Settings</NavLink>
        <NavLink to={`${adminBase}/audit`}><Activity size={18} /> Audit</NavLink>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="microcopy">Admin Studio</p>
            <h1>{getPageTitle(routePath)}</h1>
          </div>
          <div className="admin-search">
            <Search size={16} />
            <input placeholder="Search products, orders, clients" />
          </div>
          <button className="admin-sign-out" type="button" onClick={signOut}>
            Sign out
          </button>
        </header>
        {renderRoute()}
      </section>
    </div>
  );
}
