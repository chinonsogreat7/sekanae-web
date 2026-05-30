import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bold,
  Boxes,
  ClipboardList,
  Code2,
  Edit3,
  Eye,
  Globe2,
  Heading2,
  Italic,
  KeyRound,
  Layers3,
  Link2,
  LifeBuoy,
  List,
  ListOrdered,
  MailCheck,
  PackagePlus,
  Pilcrow,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { type ChangeEvent, type ClipboardEvent, type DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { getProducts } from "../api/client";
import { getApiBaseUrl } from "../api/config";
import { CustomSelect } from "../components/CustomSelect";
import { categories as fallbackCategories, products as fallbackProducts, type Collection, type CurrencyCode, type Product } from "../data/catalog";
import { defaultExchangeRates, formatCurrencyAmount, formatMoney, type ExchangeRates } from "../utils/money";

const apiBaseUrl = getApiBaseUrl();
const adminTokenStorageKey = "sekanae_admin_token";
const productsPerPage = 8;
const maxAdminImageUploadBytes = 8 * 1024 * 1024;
const bulkProductCsvColumns = [
  "name",
  "category",
  "collection",
  "price",
  "colors",
  "material",
  "occasion",
  "imageFiles",
  "description",
  "detailsMaterials",
  "detailsDimensions",
  "detailsCare",
  "detailsShipping",
  "stock",
  "rating",
  "reviews",
  "tags",
  "isNew",
  "isBridalPreview",
] as const;

const orderStatuses = ["pending", "paid", "processing", "fulfilled", "cancelled", "refunded"] as const;
const paymentStatuses = ["unpaid", "requires_action", "paid", "failed", "refunded"] as const;
const conciergeStatuses = ["open", "in_progress", "resolved", "closed"] as const;
const replyStatuses = ["not_replied", "reply_needed", "replied"] as const;
const contentTypes = ["journal", "newsletter", "homepage", "social", "product_story"] as const;
const contentChannels = ["website", "email", "homepage", "instagram"] as const;
const contentStatuses = ["idea", "drafting", "ready", "scheduled", "published"] as const;
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
  failureReasons?: string[];
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
  category: string;
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
  tags: string;
};

type BulkProductImportRow = {
  rowNumber: number;
  draft: ProductDraft;
  imageFileNames: string[];
  errors: string[];
};

type BulkProductImportHistoryItem = {
  id: string;
  importedCount: number;
  failedCount: number;
  createdAt: string;
  summary: string;
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
  hasAccount: boolean;
  accountCreatedAt?: string;
  accountUpdatedAt?: string;
  activeSessionCount: number;
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

type ProductCategoryOption = {
  id: string;
  name: string;
  image?: string;
  sortOrder: number;
};

type CategoryDraft = {
  id: string;
  name: string;
  image: string;
  sortOrder: string;
};

type ConciergeStatus = typeof conciergeStatuses[number];
type ReplyStatus = typeof replyStatuses[number];
type ContentType = typeof contentTypes[number];
type ContentChannel = typeof contentChannels[number];
type ContentStatus = typeof contentStatuses[number];

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

type ContentItem = {
  id: string;
  title: string;
  contentType: ContentType;
  channel: ContentChannel;
  status: ContentStatus | "archived";
  publishAt?: string;
  owner?: string;
  brief?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  createdAt: string;
  updatedAt: string;
};

type ContentDraft = {
  id: string;
  title: string;
  contentType: ContentType;
  channel: ContentChannel;
  status: ContentStatus;
  publishAt: string;
  owner: string;
  brief: string;
  ctaLabel: string;
  ctaUrl: string;
};

type StoreSettings = {
  defaultCurrency: CurrencyCode;
  defaultMarketCountry: string;
  defaultShippingAmount: number;
  vatRate: number;
  vatIncluded: boolean;
  exchangeRates: ExchangeRates;
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
  media: boolean;
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

type AdminMediaUpload = {
  url: string;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function productIdFromName(value: string) {
  const slug = slugify(value);
  return slug ? `p-${slug}` : "";
}

function parseList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePipeList(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === "\"") {
      if (isQuoted && nextCharacter === "\"") {
        cell += "\"";
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (character === "," && !isQuoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !isQuoted) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

function csvEscape(value: string | number | boolean) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function parseBoolean(value: string) {
  return ["true", "yes", "1", "y"].includes(value.trim().toLowerCase());
}

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error(`Unable to read ${file.name}.`));
    });
    reader.addEventListener("error", () => reject(new Error(`Unable to read ${file.name}.`)));
    reader.readAsText(file);
  });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error(`Unable to read ${file.name}.`));
    });
    reader.addEventListener("error", () => reject(new Error(`Unable to read ${file.name}.`)));
    reader.readAsDataURL(file);
  });
}

function plainTextFromHtml(value: string) {
  const documentBody = new DOMParser().parseFromString(value, "text/html").body;
  return documentBody.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function productTags(product: Product) {
  const tags = product.tags ?? [];
  return tags.length ? tags : [
    ...(product.isNew ? ["New arrival"] : []),
    ...(product.isBridalPreview ? ["Bridal preview"] : []),
  ];
}

function colorSwatchStyle(color: string) {
  return color.startsWith("#") ? { background: color } : undefined;
}

function colorSwatchClass(color: string) {
  return color.startsWith("#") ? "swatch" : `swatch swatch-${color.toLowerCase().replaceAll(" ", "-")}`;
}

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toDateTimeInputValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function createProductDraft(): ProductDraft {
  return {
    id: "",
    slug: "",
    name: "",
    category: "Jewelry",
    collection: "",
    price: "",
    colors: "#000000",
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
    tags: "",
  };
}

function productImportRowsFromCsv(text: string): BulkProductImportRow[] {
  const rows = parseCsv(text);
  const [headerRow, ...dataRows] = rows;

  if (!headerRow) {
    throw new Error("Upload a CSV with product headers.");
  }

  const headers = headerRow.map((header) => header.trim());
  const missingHeaders = bulkProductCsvColumns.filter((column) => !headers.includes(column));

  if (missingHeaders.length) {
    throw new Error(`Missing CSV column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}`);
  }

  return dataRows.map((row, index) => {
    const record = Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] ?? ""]));
    const draft = createProductDraft();
    const imageFileNames = parsePipeList(record.imageFiles);
    const errors: string[] = [];

    draft.name = record.name;
    draft.id = productIdFromName(record.name);
    draft.slug = slugify(record.name);
    draft.category = record.category || draft.category;
    draft.collection = record.collection;
    draft.price = record.price;
    draft.colors = record.colors;
    draft.material = record.material;
    draft.occasion = record.occasion;
    draft.description = record.description;
    draft.detailsMaterials = record.detailsMaterials;
    draft.detailsDimensions = record.detailsDimensions;
    draft.detailsCare = record.detailsCare;
    draft.detailsShipping = record.detailsShipping;
    draft.stock = record.stock || "0";
    draft.rating = record.rating || "0";
    draft.reviews = record.reviews || "0";
    draft.tags = record.tags;
    draft.isNew = parseBoolean(record.isNew);
    draft.isBridalPreview = parseBoolean(record.isBridalPreview);

    if (!draft.name.trim()) errors.push("Name is required.");
    if (!draft.category.trim()) errors.push("Category is required.");
    if (!draft.collection.trim()) errors.push("Collection is required.");
    if (!draft.price.trim() || Number.isNaN(Number(draft.price))) errors.push("Price must be a number.");
    if (!parseList(draft.colors).length) errors.push("Add at least one color.");
    if (!draft.material.trim()) errors.push("Material is required.");
    if (!parseList(draft.occasion).length) errors.push("Add at least one occasion.");
    if (!imageFileNames.length) errors.push("Add at least one image file name.");
    if (!draft.description.trim()) errors.push("Description is required.");
    if (!draft.detailsMaterials.trim()) errors.push("Details materials is required.");
    if (!draft.detailsDimensions.trim()) errors.push("Details dimensions is required.");
    if (!draft.detailsCare.trim()) errors.push("Details care is required.");
    if (!draft.detailsShipping.trim()) errors.push("Details shipping is required.");
    if (Number.isNaN(Number(draft.stock))) errors.push("Stock must be a number.");
    if (Number.isNaN(Number(draft.rating))) errors.push("Rating must be a number.");
    if (Number.isNaN(Number(draft.reviews))) errors.push("Reviews must be a number.");

    return {
      rowNumber: index + 2,
      draft,
      imageFileNames,
      errors,
    };
  });
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

function createCategoryDraft(): CategoryDraft {
  return {
    id: "",
    name: "",
    image: "",
    sortOrder: "0",
  };
}

function createContentDraft(): ContentDraft {
  return {
    id: "",
    title: "",
    contentType: "journal",
    channel: "website",
    status: "idea",
    publishAt: "",
    owner: "",
    brief: "",
    ctaLabel: "",
    ctaUrl: "",
  };
}

function contentToDraft(item: ContentItem): ContentDraft {
  return {
    id: item.id,
    title: item.title,
    contentType: item.contentType,
    channel: item.channel,
    status: item.status === "archived" ? "idea" : item.status,
    publishAt: toDateTimeInputValue(item.publishAt),
    owner: item.owner ?? "",
    brief: item.brief ?? "",
    ctaLabel: item.ctaLabel ?? "",
    ctaUrl: item.ctaUrl ?? "",
  };
}

function collectionToDraft(collection: Collection, sortOrder = 0): CollectionDraft {
  return {
    ...collection,
    sortOrder: String(sortOrder),
  };
}

function categoryToDraft(category: ProductCategoryOption): CategoryDraft {
  return {
    id: category.id,
    name: category.name,
    image: category.image ?? "",
    sortOrder: String(category.sortOrder),
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
    tags: productTags(product).join(", "),
  };
}

function draftToProduct(draft: ProductDraft): Product {
  const tags = parseList(draft.tags);

  return {
    id: draft.id.trim() || productIdFromName(draft.name),
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
    tags,
    isNew: draft.isNew || tags.includes("New arrival") || undefined,
    isBridalPreview: draft.isBridalPreview || tags.includes("Bridal preview") || undefined,
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
  if (routePath === "customers") return "Users";
  if (routePath.startsWith("customers/")) return "User Detail";
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
  const [isNewsletterSourceMode, setIsNewsletterSourceMode] = useState(false);
  const newsletterEditorRef = useRef<HTMLDivElement | null>(null);
  const collectionFormRef = useRef<HTMLFormElement | null>(null);
  const categoryFormRef = useRef<HTMLFormElement | null>(null);
  const contentFormRef = useRef<HTMLFormElement | null>(null);
  const productImageInputRef = useRef<HTMLInputElement | null>(null);
  const bulkProductCsvInputRef = useRef<HTMLInputElement | null>(null);
  const bulkProductImageInputRef = useRef<HTMLInputElement | null>(null);
  const collectionImageInputRef = useRef<HTMLInputElement | null>(null);
  const categoryImageInputRef = useRef<HTMLInputElement | null>(null);
  const [adminProducts, setAdminProducts] = useState<Product[]>(fallbackProducts);
  const [productDraft, setProductDraft] = useState<ProductDraft>(() => createProductDraft());
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [productImageError, setProductImageError] = useState<string | null>(null);
  const [bulkProductRows, setBulkProductRows] = useState<BulkProductImportRow[]>([]);
  const [bulkProductImages, setBulkProductImages] = useState<File[]>([]);
  const [bulkProductMessage, setBulkProductMessage] = useState<string | null>(null);
  const [bulkProductHistory, setBulkProductHistory] = useState<BulkProductImportHistoryItem[]>([]);
  const [isBulkImportingProducts, setIsBulkImportingProducts] = useState(false);
  const [customProductTag, setCustomProductTag] = useState("");
  const [customProductTagError, setCustomProductTagError] = useState<string | null>(null);
  const [inventoryDrafts, setInventoryDrafts] = useState<Record<string, string>>({});
  const [productPage, setProductPage] = useState(1);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [productStockFilter, setProductStockFilter] = useState<"" | "low" | "out">("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"" | "category" | "collection" | "stock" | "new" | "bridal" | "archive">("");
  const [bulkActionValue, setBulkActionValue] = useState("");
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
  const [isUploadingCollectionImage, setIsUploadingCollectionImage] = useState(false);
  const [categories, setCategories] = useState<ProductCategoryOption[]>([]);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(() => createCategoryDraft());
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [isUploadingCategoryImage, setIsUploadingCategoryImage] = useState(false);
  const [conciergeRequests, setConciergeRequests] = useState<ConciergeRequest[]>([]);
  const [conciergeFilter, setConciergeFilter] = useState<"" | ConciergeStatus>("");
  const [conciergeMessage, setConciergeMessage] = useState<string | null>(null);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentTotal, setContentTotal] = useState(0);
  const [contentFilter, setContentFilter] = useState<"" | ContentStatus>("");
  const [contentDraft, setContentDraft] = useState<ContentDraft>(() => createContentDraft());
  const [contentMessage, setContentMessage] = useState<string | null>(null);
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

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();

    return adminProducts.filter((product) => {
      const matchesSearch = !search || [
        product.name,
        product.category,
        product.collection,
        product.material,
        product.description,
        productTags(product).join(" "),
      ].some((value) => value.toLowerCase().includes(search));
      const matchesCategory = !productCategoryFilter || product.category === productCategoryFilter;
      const matchesStock = productStockFilter === "low"
        ? product.stock > 0 && product.stock <= 5
        : productStockFilter === "out"
          ? product.stock === 0
          : true;

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [adminProducts, productCategoryFilter, productSearch, productStockFilter]);
  const productPageCount = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
  const customerPageCount = Math.max(1, Math.ceil(customersTotal / productsPerPage));
  const visibleProducts = useMemo(() => {
    const firstProduct = (productPage - 1) * productsPerPage;
    return filteredProducts.slice(firstProduct, firstProduct + productsPerPage);
  }, [filteredProducts, productPage]);
  const selectedProducts = useMemo(
    () => adminProducts.filter((product) => selectedProductIds.includes(product.id)),
    [adminProducts, selectedProductIds],
  );
  const lowStockProducts = useMemo(
    () => adminProducts.filter((product) => product.stock > 0 && product.stock <= 5),
    [adminProducts],
  );
  const categoryOptions = useMemo(
    () => [...new Set([
      ...fallbackCategories,
      ...categories.map((category) => category.name),
      ...adminProducts.map((product) => product.category),
      productDraft.category,
    ].filter(Boolean))].sort(),
    [adminProducts, categories, productDraft.category],
  );
  const bulkProductImportStatus = useMemo(() => {
    const validRows = bulkProductRows.filter((row) => !row.errors.length);
    const invalidRows = bulkProductRows.length - validRows.length;

    return {
      validRows,
      invalidRows,
    };
  }, [bulkProductRows]);
  const tagOptions = useMemo(
    () => [...new Set([
      "New arrival",
      "Bridal preview",
      ...adminProducts.flatMap((product) => productTags(product)),
      ...parseList(productDraft.tags),
    ].filter(Boolean))].sort(),
    [adminProducts, productDraft.tags],
  );

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
    void readCategories();
    void readConcierge();
    void readContent();
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
    setProductPage(1);
  }, [productCategoryFilter, productSearch, productStockFilter]);

  useEffect(() => {
    if (customerPage > customerPageCount) {
      setCustomerPage(customerPageCount);
    }
  }, [customerPage, customerPageCount]);

  useEffect(() => {
    if (!isNewsletterSourceMode && newsletterEditorRef.current && newsletterEditorRef.current.innerHTML !== html) {
      newsletterEditorRef.current.innerHTML = html;
    }
  }, [html, isNewsletterSourceMode]);

  useEffect(() => {
    if (routePath === "products/new") {
      setProductDraft(createProductDraft());
      setProductMessage(null);
      setProductImageError(null);
      setCustomProductTag("");
      setCustomProductTagError(null);
      return;
    }

    if (routePath.startsWith("products/") && routePath.endsWith("/edit") && selectedProduct) {
      setProductDraft(productToDraft(selectedProduct));
      setProductMessage(null);
      setProductImageError(null);
      setCustomProductTag("");
      setCustomProductTagError(null);
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
    setContentItems([]);
    setContentDraft(createContentDraft());
    setContentTotal(0);
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

  async function readCategories() {
    if (!adminToken) {
      return;
    }

    try {
      const payload = await readAdmin<ProductCategoryOption[]>("/api/admin/categories");
      setCategories(payload.data);
      setCategoryMessage(null);
    } catch (error) {
      setCategories([]);
      setCategoryMessage(error instanceof Error ? error.message : "Categories are unavailable.");
    }
  }

  async function saveCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCollectionMessage(null);

    if (!collectionDraft.image.trim()) {
      setCollectionMessage("Upload a collection image before saving.");
      return;
    }

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

  function editCollection(collection: Collection, index: number) {
    setCollectionDraft(collectionToDraft(collection, index));
    setCollectionMessage(`Editing ${collection.title}. Update the form and save when ready.`);
    collectionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryMessage(null);

    try {
      const payload = await readAdmin<ProductCategoryOption>("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          id: categoryDraft.id.trim() || undefined,
          name: categoryDraft.name.trim(),
          image: categoryDraft.image.trim() || undefined,
          sortOrder: Number(categoryDraft.sortOrder),
        }),
      });

      setCategoryMessage(`${payload.data.name} has been saved.`);
      setCategoryDraft(categoryToDraft(payload.data));
      await readCategories();
      await readProducts();
      await readAudit();
    } catch (error) {
      setCategoryMessage(error instanceof Error ? error.message : "Category save failed.");
    }
  }

  async function archiveCategory(categoryId: string) {
    if (!window.confirm("Archive this category? Existing products will keep their category text, but the category will be removed from admin category options.")) {
      return;
    }

    try {
      await readAdmin<{ archived: boolean }>(`/api/admin/categories/${encodeURIComponent(categoryId)}`, {
        method: "DELETE",
      });
      setCategoryMessage("Category archived.");
      setCategoryDraft(createCategoryDraft());
      await readCategories();
      await readProducts();
      await readAudit();
    } catch (error) {
      setCategoryMessage(error instanceof Error ? error.message : "Category archive failed.");
    }
  }

  function editCategory(category: ProductCategoryOption) {
    setCategoryDraft(categoryToDraft(category));
    setCategoryMessage(`Editing ${category.name}. Update the form and save when ready.`);
    categoryFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function downloadBulkProductTemplate() {
    const sampleRow = [
      "Monde Structured Top Handle",
      "Handbags",
      "Voyage Essentials",
      "640",
      "#3c3434, Black",
      "Italian leather",
      "Work, Travel",
      "monde-front.jpg|monde-side.jpg",
      "Structured top-handle bag for polished daily movement.",
      "Italian leather, cotton lining",
      "28cm W x 20cm H x 10cm D",
      "Store in dust bag and wipe clean.",
      "Ships in 2-4 business days.",
      "12",
      "0",
      "0",
      "New arrival",
      "true",
      "false",
    ];
    const csv = [
      bulkProductCsvColumns.join(","),
      sampleRow.map(csvEscape).join(","),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = "sekanae-product-bulk-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadBulkProductCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const rows = productImportRowsFromCsv(await readTextFile(file));
      setBulkProductRows(rows);
      setBulkProductMessage(`${rows.length} product row${rows.length === 1 ? "" : "s"} loaded from ${file.name}.`);
    } catch (error) {
      setBulkProductRows([]);
      setBulkProductMessage(error instanceof Error ? error.message : "Unable to read product CSV.");
    }
  }

  function selectBulkProductImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    setBulkProductImages(files);
    setBulkProductMessage(`${files.length} product image file${files.length === 1 ? "" : "s"} selected.`);
  }

  async function importBulkProducts() {
    if (!adminToken) {
      setBulkProductMessage("Sign in again to import products.");
      return;
    }

    const validRows = bulkProductImportStatus.validRows;
    if (!validRows.length) {
      setBulkProductMessage("Load a valid product CSV before importing.");
      return;
    }

    const imageFilesByName = new Map(bulkProductImages.map((file) => [file.name, file]));
    const missingImageNames = [...new Set(validRows.flatMap((row) => row.imageFileNames))]
      .filter((fileName) => !imageFilesByName.has(fileName));

    if (missingImageNames.length) {
      setBulkProductMessage(`Select these image files before importing: ${missingImageNames.join(", ")}`);
      return;
    }

    setIsBulkImportingProducts(true);
    setBulkProductMessage("Uploading images and creating products...");

    const uploadedImageUrls = new Map<string, string>();
    let importedCount = 0;
    const failedRows: string[] = [];

    try {
      for (const row of validRows) {
        try {
          const imageUrls: string[] = [];

          for (const fileName of row.imageFileNames) {
            const cachedUrl = uploadedImageUrls.get(fileName);

            if (cachedUrl) {
              imageUrls.push(cachedUrl);
              continue;
            }

            const file = imageFilesByName.get(fileName);
            if (!file) {
              throw new Error(`${fileName} was not selected.`);
            }

            const [uploadedUrl] = await uploadAdminImages([file]);
            uploadedImageUrls.set(fileName, uploadedUrl);
            imageUrls.push(uploadedUrl);
          }

          const product = draftToProduct({
            ...row.draft,
            images: imageUrls.join("\n"),
          });

          await readAdmin<Product>("/api/admin/products", {
            method: "POST",
            body: JSON.stringify(product),
          });
          importedCount += 1;
        } catch (error) {
          failedRows.push(`Row ${row.rowNumber}: ${error instanceof Error ? error.message : "Import failed."}`);
        }
      }

      await readProducts();
      await readDashboard();
      await readAudit();

      const summary = [
        `${importedCount} product${importedCount === 1 ? "" : "s"} imported.`,
        failedRows.length ? `${failedRows.length} failed: ${failedRows.join(" ")}` : "",
      ].filter(Boolean).join(" ");

      setBulkProductHistory((current) => [
        {
          id: `${Date.now()}`,
          importedCount,
          failedCount: failedRows.length,
          createdAt: new Date().toISOString(),
          summary,
        },
        ...current,
      ].slice(0, 5));
      setBulkProductMessage(summary);
    } finally {
      setIsBulkImportingProducts(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminToken) {
      setProductMessage("Sign in again to continue.");
      return;
    }

    if (!parseList(productDraft.images).length) {
      setProductMessage("Upload at least one product image before saving.");
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

  function toggleProductSelection(productId: string) {
    setSelectedProductIds((current) => (
      current.includes(productId)
        ? current.filter((selectedId) => selectedId !== productId)
        : [...current, productId]
    ));
  }

  function toggleVisibleProductSelection() {
    const visibleIds = visibleProducts.map((product) => product.id);
    const allVisibleSelected = visibleIds.every((productId) => selectedProductIds.includes(productId));

    setSelectedProductIds((current) => {
      if (allVisibleSelected) {
        return current.filter((productId) => !visibleIds.includes(productId));
      }

      return [...new Set([...current, ...visibleIds])];
    });
  }

  async function runBulkProductAction() {
    if (!selectedProducts.length) {
      setProductMessage("Select products before running a bulk action.");
      return;
    }

    if (!bulkAction) {
      setProductMessage("Choose a bulk action first.");
      return;
    }

    if (bulkAction === "archive" && !window.confirm(`Archive ${selectedProducts.length} selected product${selectedProducts.length === 1 ? "" : "s"}?`)) {
      return;
    }

    setProductMessage(`Running bulk action for ${selectedProducts.length} product${selectedProducts.length === 1 ? "" : "s"}...`);

    const failures: string[] = [];

    for (const product of selectedProducts) {
      try {
        if (bulkAction === "archive") {
          await readAdmin<{ archived: boolean }>(`/api/admin/products/${encodeURIComponent(product.id)}`, {
            method: "DELETE",
          });
          continue;
        }

        if (bulkAction === "stock") {
          const quantity = Number(bulkActionValue);

          if (!Number.isInteger(quantity) || quantity < 0) {
            throw new Error("Stock must be a non-negative whole number.");
          }

          await readAdmin<Product>(`/api/admin/products/${encodeURIComponent(product.id)}/inventory`, {
            method: "PATCH",
            body: JSON.stringify({ quantity }),
          });
          continue;
        }

        const nextTags = productTags(product);
        const patch = {
          ...product,
          tags: nextTags,
        };

        if (bulkAction === "category") {
          patch.category = bulkActionValue.trim();
        }

        if (bulkAction === "collection") {
          patch.collection = bulkActionValue.trim();
        }

        if (bulkAction === "new") {
          patch.isNew = true;
          patch.tags = [...new Set([...nextTags, "New arrival"])];
        }

        if (bulkAction === "bridal") {
          patch.isBridalPreview = true;
          patch.tags = [...new Set([...nextTags, "Bridal preview"])];
        }

        if ((bulkAction === "category" || bulkAction === "collection") && !bulkActionValue.trim()) {
          throw new Error("Enter a value for this bulk action.");
        }

        await readAdmin<Product>("/api/admin/products", {
          method: "POST",
          body: JSON.stringify(patch),
        });
      } catch (error) {
        failures.push(`${product.name}: ${error instanceof Error ? error.message : "Update failed."}`);
      }
    }

    await readProducts();
    await readDashboard();
    await readAudit();
    setSelectedProductIds([]);
    setProductMessage(failures.length
      ? `Bulk action finished with ${failures.length} failure${failures.length === 1 ? "" : "s"}: ${failures.join(" ")}`
      : `Bulk action completed for ${selectedProducts.length} product${selectedProducts.length === 1 ? "" : "s"}.`);
  }

  function updateProductName(value: string) {
    setProductDraft((current) => {
      const generatedSlug = slugify(value);
      const shouldRefreshGeneratedSlug = !current.slug || current.slug === slugify(current.name);
      const shouldRefreshGeneratedId = !current.id || current.id === productIdFromName(current.name);

      return {
        ...current,
        name: value,
        slug: shouldRefreshGeneratedSlug ? generatedSlug : current.slug,
        id: shouldRefreshGeneratedId ? productIdFromName(value) : current.id,
      };
    });
  }

  function updateProductColor(index: number, value: string) {
    const colors = parseList(productDraft.colors);
    colors[index] = value;
    setProductDraft((current) => ({ ...current, colors: colors.join(", ") }));
  }

  function addProductColor() {
    const colors = parseList(productDraft.colors);
    setProductDraft((current) => ({ ...current, colors: [...colors, "#000000"].join(", ") }));
  }

  function removeProductColor(index: number) {
    const colors = parseList(productDraft.colors).filter((_, colorIndex) => colorIndex !== index);
    setProductDraft((current) => ({ ...current, colors: colors.join(", ") }));
  }

  function toggleProductTag(tag: string) {
    const tags = parseList(productDraft.tags);
    const nextTags = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];

    setCustomProductTagError(null);
    setProductDraft((current) => ({
      ...current,
      tags: nextTags.join(", "),
      isNew: nextTags.includes("New arrival"),
      isBridalPreview: nextTags.includes("Bridal preview"),
    }));
  }

  function addProductTag() {
    const tag = customProductTag.trim().replace(/\s+/g, " ");

    if (!tag) {
      setCustomProductTagError("Enter a tag name first.");
      return;
    }

    const tags = parseList(productDraft.tags);

    if (tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setCustomProductTagError(`${tag} is already selected.`);
      return;
    }

    const nextTags = [...tags, tag];
    setProductDraft((current) => ({
      ...current,
      tags: nextTags.join(", "),
      isNew: nextTags.includes("New arrival"),
      isBridalPreview: nextTags.includes("Bridal preview"),
    }));
    setCustomProductTag("");
    setCustomProductTagError(null);
  }

  function setProductImages(images: string[]) {
    setProductDraft((current) => ({ ...current, images: images.join("\n") }));
  }

  function removeProductImage(index: number) {
    const images = parseList(productDraft.images).filter((_, imageIndex) => imageIndex !== index);
    setProductImages(images);
    setProductImageError(null);
  }

  function makePrimaryProductImage(index: number) {
    const images = parseList(productDraft.images);
    const [image] = images.splice(index, 1);

    if (!image) return;

    setProductImages([image, ...images]);
    setProductImageError(null);
  }

  function moveProductImage(index: number, direction: -1 | 1) {
    const images = parseList(productDraft.images);
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= images.length) return;

    [images[index], images[nextIndex]] = [images[nextIndex], images[index]];
    setProductImages(images);
    setProductImageError(null);
  }

  async function uploadAdminImages(files: File[]) {
    if (!adminToken) {
      throw new Error("Sign in again to upload images.");
    }

    const nonImageFile = files.find((file) => !file.type.startsWith("image/"));
    if (nonImageFile) {
      throw new Error(`${nonImageFile.name} is not an image file.`);
    }

    const oversizedFile = files.find((file) => file.size > maxAdminImageUploadBytes);
    if (oversizedFile) {
      throw new Error(`${oversizedFile.name} is larger than 8 MB.`);
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      const data = await fileToDataUrl(file);
      const payload = await readAdmin<AdminMediaUpload>("/api/admin/media/upload", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          data,
        }),
      });

      uploadedUrls.push(payload.data.url);
    }

    return uploadedUrls;
  }

  async function uploadProductImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    await uploadProductImageFiles(files);
  }

  async function uploadProductImageFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (!files.length) {
      return;
    }

    if (imageFiles.length !== files.length) {
      setProductImageError("Only image files can be uploaded.");
      return;
    }

    setIsUploadingImages(true);
    setProductMessage(null);
    setProductImageError(null);

    try {
      const uploadedUrls = await uploadAdminImages(imageFiles);

      setProductDraft((current) => ({
        ...current,
        images: [...parseList(current.images), ...uploadedUrls].join("\n"),
      }));
      setProductMessage(`${uploadedUrls.length} image${uploadedUrls.length === 1 ? "" : "s"} uploaded to Cloudinary. Save the product to publish the update.`);
    } catch (error) {
      setProductImageError(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setIsUploadingImages(false);
    }
  }

  function dropProductImages(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (isUploadingImages) {
      return;
    }

    void uploadProductImageFiles(Array.from(event.dataTransfer.files));
  }

  async function uploadCollectionImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsUploadingCollectionImage(true);
    setCollectionMessage(null);

    try {
      const [uploadedUrl] = await uploadAdminImages([file]);
      setCollectionDraft((current) => ({ ...current, image: uploadedUrl }));
      setCollectionMessage("Collection image uploaded to Cloudinary. Save the collection to publish the update.");
    } catch (error) {
      setCollectionMessage(error instanceof Error ? error.message : "Collection image upload failed.");
    } finally {
      setIsUploadingCollectionImage(false);
    }
  }

  async function uploadCategoryImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsUploadingCategoryImage(true);
    setCategoryMessage(null);

    try {
      const [uploadedUrl] = await uploadAdminImages([file]);
      setCategoryDraft((current) => ({ ...current, image: uploadedUrl }));
      setCategoryMessage("Category image uploaded to Cloudinary. Save the category to publish the update.");
    } catch (error) {
      setCategoryMessage(error instanceof Error ? error.message : "Category image upload failed.");
    } finally {
      setIsUploadingCategoryImage(false);
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

  function syncNewsletterHtml(nextHtml: string) {
    setHtml(nextHtml);
    setText(plainTextFromHtml(nextHtml));
  }

  function runNewsletterCommand(command: string, value?: string) {
    newsletterEditorRef.current?.focus();
    document.execCommand(command, false, value);

    if (newsletterEditorRef.current) {
      syncNewsletterHtml(newsletterEditorRef.current.innerHTML);
    }
  }

  function addNewsletterLink() {
    const url = window.prompt("Paste link URL");

    if (!url?.trim()) {
      return;
    }

    runNewsletterCommand("createLink", url.trim());
  }

  function handleNewsletterEditorInput() {
    if (newsletterEditorRef.current) {
      syncNewsletterHtml(newsletterEditorRef.current.innerHTML);
    }
  }

  function handleNewsletterPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const pastedText = event.clipboardData.getData("text/plain");

    if (!pastedText) {
      return;
    }

    document.execCommand("insertText", false, pastedText);
    handleNewsletterEditorInput();
  }

  function insertNewsletterTemplate() {
    const template = `
      <h2>New from SEKANAE</h2>
      <p>A considered edit of pieces for the season ahead.</p>
      <p><a href="https://sekanae.co/shop">Shop the latest arrivals</a></p>
    `.trim();

    syncNewsletterHtml(template);
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
          text: text.trim().length >= 20 ? text : undefined,
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

  async function readContent() {
    if (!adminToken) {
      return;
    }

    const query = new URLSearchParams({ limit: "80" });

    if (contentFilter) {
      query.set("status", contentFilter);
    }

    try {
      const payload = await readAdmin<ContentItem[]>(`/api/admin/content?${query.toString()}`);
      setContentItems(payload.data);
      setContentTotal(payload.meta?.total ?? payload.data.length);
      setContentMessage(payload.data.length ? null : "No content items match this view yet.");
    } catch (error) {
      setContentItems([]);
      setContentTotal(0);
      setContentMessage(error instanceof Error ? error.message : "Content planner is unavailable.");
    }
  }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContentMessage(null);

    try {
      const payload = await readAdmin<ContentItem>("/api/admin/content", {
        method: "POST",
        body: JSON.stringify({
          id: contentDraft.id || undefined,
          title: contentDraft.title.trim(),
          contentType: contentDraft.contentType,
          channel: contentDraft.channel,
          status: contentDraft.status,
          publishAt: contentDraft.publishAt ? new Date(contentDraft.publishAt).toISOString() : undefined,
          owner: contentDraft.owner.trim() || undefined,
          brief: contentDraft.brief.trim() || undefined,
          ctaLabel: contentDraft.ctaLabel.trim() || undefined,
          ctaUrl: contentDraft.ctaUrl.trim() || undefined,
        }),
      });

      setContentDraft(contentToDraft(payload.data));
      setContentMessage(`${payload.data.title} has been saved.`);
      await readContent();
      await readAudit();
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : "Content save failed.");
    }
  }

  function editContent(item: ContentItem) {
    setContentDraft(contentToDraft(item));
    setContentMessage(`Editing ${item.title}.`);
    contentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function updateContentItem(itemId: string, patch: Partial<Pick<ContentItem, "status">>) {
    try {
      await readAdmin<ContentItem>(`/api/admin/content/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setContentMessage("Content item updated.");
      await readContent();
      await readAudit();
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : "Content update failed.");
    }
  }

  async function archiveContentItem(itemId: string) {
    try {
      await readAdmin<{ archived: boolean }>(`/api/admin/content/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      setContentDraft((current) => current.id === itemId ? createContentDraft() : current);
      setContentMessage("Content item archived.");
      await readContent();
      await readAudit();
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : "Content archive failed.");
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
      setSettingsDraft({
        ...settingsPayload.data,
        exchangeRates: {
          ...defaultExchangeRates,
          ...settingsPayload.data.exchangeRates,
        },
      });
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
          exchangeRates: Object.fromEntries(currencyOptions.map((currency) => [
            currency,
            Number(settingsDraft.exchangeRates?.[currency] ?? defaultExchangeRates[currency]),
          ])),
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
        value: metrics ? formatMoney(metrics.revenue, "EUR") : "-",
        note: "Confirmed order value",
      },
      {
        label: "Orders",
        value: String(metrics?.orders ?? "-"),
        note: "All-time order count",
      },
      {
        label: "Users",
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
                  <span>{formatCurrencyAmount(order.total, order.currency)}</span>
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
              <Link to={`${adminBase}/customers`}><Users size={18} /> Users</Link>
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
                Showing {visibleProducts.length} of {filteredProducts.length} matching products
              </p>
            </div>
            <Link className="admin-button-link" to={`${adminBase}/products/new`}>
              <PackagePlus size={16} /> New product
            </Link>
          </div>
          {lowStockProducts.length > 0 && (
            <div className="admin-low-stock-alert">
              <strong>{lowStockProducts.length} low-stock product{lowStockProducts.length === 1 ? "" : "s"}</strong>
              <span>{lowStockProducts.slice(0, 4).map((product) => `${product.name} (${product.stock})`).join(", ")}</span>
              <button type="button" onClick={() => setProductStockFilter("low")}>Review</button>
            </div>
          )}
          <div className="admin-product-tools">
            <label>
              Search products
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search name, material, tag..."
              />
            </label>
            <CustomSelect
              label="Category"
              className="admin-custom-select admin-form-select"
              value={productCategoryFilter}
              onChange={setProductCategoryFilter}
              options={[{ label: "All categories", value: "" }, ...categoryOptions.map((category) => ({ label: category, value: category }))]}
            />
            <CustomSelect
              label="Stock"
              className="admin-custom-select admin-form-select"
              value={productStockFilter}
              onChange={(value) => setProductStockFilter(value as "" | "low" | "out")}
              options={[
                { label: "All stock", value: "" },
                { label: "Low stock", value: "low" },
                { label: "Out of stock", value: "out" },
              ]}
            />
            <button
              type="button"
              onClick={() => {
                setProductSearch("");
                setProductCategoryFilter("");
                setProductStockFilter("");
              }}
            >
              Clear filters
            </button>
          </div>
          <div className="admin-bulk-actions-panel">
            <div>
              <strong>{selectedProductIds.length} selected</strong>
              <button type="button" onClick={toggleVisibleProductSelection}>
                {visibleProducts.length && visibleProducts.every((product) => selectedProductIds.includes(product.id)) ? "Unselect page" : "Select page"}
              </button>
              <button type="button" onClick={() => setSelectedProductIds([])} disabled={!selectedProductIds.length}>Clear</button>
            </div>
            <CustomSelect
              label="Bulk action"
              className="admin-custom-select admin-form-select"
              value={bulkAction}
              onChange={(value) => {
                setBulkAction(value as typeof bulkAction);
                setBulkActionValue("");
              }}
              options={[
                { label: "Choose action", value: "" },
                { label: "Change category", value: "category" },
                { label: "Change collection", value: "collection" },
                { label: "Set stock", value: "stock" },
                { label: "Mark new arrival", value: "new" },
                { label: "Mark bridal preview", value: "bridal" },
                { label: "Archive selected", value: "archive" },
              ]}
            />
            {(bulkAction === "category" || bulkAction === "collection" || bulkAction === "stock") && (
              <label>
                Value
                <input
                  type={bulkAction === "stock" ? "number" : "text"}
                  min={bulkAction === "stock" ? 0 : undefined}
                  value={bulkActionValue}
                  onChange={(event) => setBulkActionValue(event.target.value)}
                  placeholder={bulkAction === "category" ? "Jewelry" : bulkAction === "collection" ? "Everyday Elegance" : "0"}
                />
              </label>
            )}
            <button type="button" onClick={runBulkProductAction} disabled={!selectedProductIds.length || !bulkAction}>
              Apply
            </button>
          </div>
          <div className="admin-bulk-upload">
            <div>
              <strong>Bulk add products</strong>
              <p>
                Upload a CSV, then select the matching image files from your computer. The imageFiles column should list file names separated by |.
              </p>
            </div>
            <div className="admin-bulk-actions">
              <button type="button" onClick={downloadBulkProductTemplate}>
                <ClipboardList size={15} /> Template
              </button>
              <button type="button" onClick={() => bulkProductCsvInputRef.current?.click()} disabled={isBulkImportingProducts}>
                <Upload size={15} /> Select CSV
              </button>
              <input
                ref={bulkProductCsvInputRef}
                className="admin-upload-file-input"
                type="file"
                accept=".csv,text/csv"
                onChange={loadBulkProductCsv}
                disabled={isBulkImportingProducts}
              />
              <button type="button" onClick={() => bulkProductImageInputRef.current?.click()} disabled={isBulkImportingProducts}>
                <Upload size={15} /> Select images
              </button>
              <input
                ref={bulkProductImageInputRef}
                className="admin-upload-file-input"
                type="file"
                accept="image/*"
                multiple
                onChange={selectBulkProductImages}
                disabled={isBulkImportingProducts}
              />
              <button type="button" onClick={importBulkProducts} disabled={isBulkImportingProducts || !bulkProductImportStatus.validRows.length}>
                {isBulkImportingProducts ? "Importing" : "Import products"}
              </button>
            </div>
            {(bulkProductRows.length > 0 || bulkProductImages.length > 0) && (
              <div className="admin-bulk-summary">
                <span>{bulkProductImportStatus.validRows.length} valid row{bulkProductImportStatus.validRows.length === 1 ? "" : "s"}</span>
                <span>{bulkProductImportStatus.invalidRows} row{bulkProductImportStatus.invalidRows === 1 ? "" : "s"} need fixes</span>
                <span>{bulkProductImages.length} image file{bulkProductImages.length === 1 ? "" : "s"} selected</span>
              </div>
            )}
            {bulkProductRows.some((row) => row.errors.length) && (
              <div className="admin-bulk-errors" role="alert">
                {bulkProductRows.filter((row) => row.errors.length).slice(0, 4).map((row) => (
                  <span key={row.rowNumber}>Row {row.rowNumber}: {row.errors.join(" ")}</span>
                ))}
              </div>
            )}
            {bulkProductMessage && <p className="admin-status admin-status-tight">{bulkProductMessage}</p>}
            {bulkProductHistory.length > 0 && (
              <div className="admin-bulk-history">
                <strong>Recent imports</strong>
                {bulkProductHistory.map((item) => (
                  <span key={item.id}>
                    {formatDate(item.createdAt)}: {item.importedCount} imported, {item.failedCount} failed
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="admin-table admin-product-table">
            <div className="admin-table-head">
              <span>Select</span><span>Product</span><span>Category</span><span>Inventory</span><span>Actions</span>
            </div>
            {visibleProducts.map((product) => (
              <div className="admin-row" key={product.id}>
                <span>
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(product.id)}
                    onChange={() => toggleProductSelection(product.id)}
                    aria-label={`Select ${product.name}`}
                  />
                </span>
                <Link to={`${adminBase}/products/${encodeURIComponent(product.id)}`}>
                  <img src={product.images[0]} alt="" /> {product.name}
                </Link>
                <span>{product.category}{product.stock > 0 && product.stock <= 5 ? <small>Low stock</small> : null}</span>
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
            <span><strong>Price</strong>{formatMoney(selectedProduct.price, "EUR")}</span>
            <span><strong>Stock</strong>{selectedProduct.stock}</span>
            <span><strong>Material</strong>{selectedProduct.material}</span>
            <span><strong>Rating</strong>{selectedProduct.rating} / 5 ({selectedProduct.reviews} reviews)</span>
            <span>
              <strong>Colors</strong>
              <span className="admin-inline-swatches">
                {selectedProduct.colors.map((color) => (
                  <i key={color} className={colorSwatchClass(color)} style={colorSwatchStyle(color)} title={color} />
                ))}
              </span>
            </span>
            <span><strong>Occasions</strong>{selectedProduct.occasion.join(", ")}</span>
            <span><strong>Tags</strong>{productTags(selectedProduct).join(", ") || "-"}</span>
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
          <div className="admin-generated-summary">
            <span><strong>Product ID</strong>{productDraft.id || "Generated after product name"}</span>
            <span><strong>Slug</strong>{productDraft.slug || "Generated after product name"}</span>
          </div>

          <section className="admin-form-section">
            <div>
              <h3>Basic information</h3>
              <p>Name the product and place it in the storefront.</p>
            </div>
            <div className="admin-form-grid admin-form-grid-compact">
              <label>
                Product name
                <input value={productDraft.name} onChange={(event) => updateProductName(event.target.value)} required />
              </label>
              <CustomSelect
                label="Category"
                className="admin-custom-select admin-form-select"
                value={productDraft.category}
                onChange={(value) => setProductDraft((current) => ({ ...current, category: value }))}
                options={categoryOptions.length ? categoryOptions : fallbackCategories}
              />
              <label>
                Collection
                <input value={productDraft.collection} onChange={(event) => setProductDraft((current) => ({ ...current, collection: event.target.value }))} required />
              </label>
              <label>
                Material
                <input value={productDraft.material} onChange={(event) => setProductDraft((current) => ({ ...current, material: event.target.value }))} required />
              </label>
            </div>
          </section>

          <section className="admin-form-section">
            <div>
              <h3>Pricing and inventory</h3>
              <p>Prices are entered in EUR and converted using market settings.</p>
            </div>
            <div className="admin-form-grid">
              <label>
                Base price (EUR)
                <input type="number" min="0" step="0.01" value={productDraft.price} onChange={(event) => setProductDraft((current) => ({ ...current, price: event.target.value }))} required />
              </label>
              <label>
                Stock
                <input type="number" min="0" step="1" value={productDraft.stock} onChange={(event) => setProductDraft((current) => ({ ...current, stock: event.target.value }))} required />
              </label>
              <label>
                Rating
                <input type="number" min="0" max="5" step="0.1" value={productDraft.rating} onChange={(event) => setProductDraft((current) => ({ ...current, rating: event.target.value }))} />
              </label>
              <label>
                Reviews
                <input type="number" min="0" step="1" value={productDraft.reviews} onChange={(event) => setProductDraft((current) => ({ ...current, reviews: event.target.value }))} />
              </label>
            </div>
          </section>

          <section className="admin-form-section">
            <div>
              <h3>Media</h3>
              <p>Upload and arrange product photos. The primary image appears first across the storefront.</p>
            </div>
            <div className="admin-form-stack">
              <div
                className="admin-media-manager"
                onDrop={dropProductImages}
                onDragOver={(event) => event.preventDefault()}
              >
                <div className="admin-media-dropzone">
                  <div>
                    <strong>{isUploadingImages ? "Uploading product photos" : "Drop product photos here"}</strong>
                    <span>{parseList(productDraft.images).length} image{parseList(productDraft.images).length === 1 ? "" : "s"} selected. Use the first image as the storefront cover.</span>
                  </div>
                  <button
                    className="admin-upload-button"
                    type="button"
                    onClick={() => productImageInputRef.current?.click()}
                    disabled={isUploadingImages}
                  >
                    <Upload size={15} aria-hidden="true" />
                    {isUploadingImages ? "Uploading" : "Select images"}
                  </button>
                  <input
                    ref={productImageInputRef}
                    className="admin-upload-file-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={uploadProductImages}
                    disabled={isUploadingImages}
                  />
                </div>

                {productImageError && <p className="admin-inline-error" role="alert">{productImageError}</p>}

                {parseList(productDraft.images).length > 0 ? (
                  <div className="admin-image-preview-grid admin-product-media-grid">
                    {parseList(productDraft.images).map((image, index) => (
                      <figure key={`${image}-${index}`}>
                        <div className="admin-media-frame">
                          <img src={image} alt="" />
                          {index === 0 && <span className="admin-primary-badge"><Star size={13} /> Primary</span>}
                        </div>
                        <figcaption>
                          <span>Image {index + 1}</span>
                          <div className="admin-media-actions">
                            {index !== 0 && (
                              <button type="button" onClick={() => makePrimaryProductImage(index)}>
                                <Star size={13} /> Primary
                              </button>
                            )}
                            <button type="button" onClick={() => moveProductImage(index, -1)} disabled={index === 0} aria-label={`Move image ${index + 1} up`}>
                              <ArrowUp size={13} />
                            </button>
                            <button type="button" onClick={() => moveProductImage(index, 1)} disabled={index === parseList(productDraft.images).length - 1} aria-label={`Move image ${index + 1} down`}>
                              <ArrowDown size={13} />
                            </button>
                            <button type="button" onClick={() => removeProductImage(index)}>
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div className="admin-media-empty">
                    <PackagePlus size={20} aria-hidden="true" />
                    <span>No product photos yet.</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="admin-form-section">
            <div>
              <h3>Options and tags</h3>
              <p>Add color choices, occasions, and merchandising labels.</p>
            </div>
            <div className="admin-form-stack">
              <div className="admin-control-group">
                Colors
                <div className="admin-color-editor">
                  {(parseList(productDraft.colors).length ? parseList(productDraft.colors) : ["#000000"]).map((color, index) => (
                    <div className="admin-color-row" key={`product-color-${index}`}>
                      <input
                        type="color"
                        value={color.startsWith("#") && color.length === 7 ? color : "#000000"}
                        onChange={(event) => updateProductColor(index, event.target.value)}
                        aria-label={`Color ${index + 1}`}
                      />
                      <strong>{color}</strong>
                      <button type="button" onClick={() => removeProductColor(index)} disabled={parseList(productDraft.colors).length <= 1}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addProductColor}>Add color</button>
                </div>
              </div>
              <label>
                Occasions
                <input
                  value={productDraft.occasion}
                  onChange={(event) => setProductDraft((current) => ({ ...current, occasion: event.target.value }))}
                  placeholder="Travel, Gift, Evening"
                  required
                />
              </label>
              <div className="admin-control-group">
                Product tags
                <div className="admin-tag-manager">
                  <div className="admin-tag-picker" aria-label="Product tag options">
                    {tagOptions.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        className={parseList(productDraft.tags).includes(tag) ? "is-selected" : ""}
                        onClick={() => toggleProductTag(tag)}
                        aria-pressed={parseList(productDraft.tags).includes(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <div className="admin-tag-composer">
                    <label>
                      Tag name
                      <input
                        value={customProductTag}
                        onChange={(event) => {
                          setCustomProductTag(event.target.value);
                          setCustomProductTagError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addProductTag();
                          }
                        }}
                        placeholder="Resort edit"
                      />
                    </label>
                    <button type="button" onClick={addProductTag}>
                      <PackagePlus size={16} aria-hidden="true" />
                      Create tag
                    </button>
                  </div>
                  {customProductTagError && (
                    <div className="admin-inline-error" role="alert">
                      {customProductTagError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="admin-form-section">
            <div>
              <h3>Description and details</h3>
              <p>Copy shown on the product page.</p>
            </div>
            <div className="admin-form-grid admin-form-grid-details">
              <label className="admin-field-wide">
                Description
                <textarea value={productDraft.description} onChange={(event) => setProductDraft((current) => ({ ...current, description: event.target.value }))} required />
              </label>
              <label>
                Materials detail
                <textarea value={productDraft.detailsMaterials} onChange={(event) => setProductDraft((current) => ({ ...current, detailsMaterials: event.target.value }))} required />
              </label>
              <label>
                Dimensions
                <textarea value={productDraft.detailsDimensions} onChange={(event) => setProductDraft((current) => ({ ...current, detailsDimensions: event.target.value }))} required />
              </label>
              <label>
                Care
                <textarea value={productDraft.detailsCare} onChange={(event) => setProductDraft((current) => ({ ...current, detailsCare: event.target.value }))} required />
              </label>
              <label>
                Shipping
                <textarea value={productDraft.detailsShipping} onChange={(event) => setProductDraft((current) => ({ ...current, detailsShipping: event.target.value }))} required />
              </label>
            </div>
          </section>
          <button className="admin-save-product-button" type="submit" disabled={isSavingProduct}>
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
            <CustomSelect
              label="Status"
              className="admin-custom-select"
              value={orderStatusFilter}
              onChange={(value) => setOrderStatusFilter(value as "" | OrderStatus)}
              options={[
                { label: "All", value: "" },
                ...orderStatuses.map((status) => ({ label: status, value: status })),
              ]}
            />
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
                <span>{formatCurrencyAmount(order.total, order.currency)}</span>
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
                <span>{formatCurrencyAmount(selectedOrder.total, selectedOrder.currency)}</span>
                <span>{formatDate(selectedOrder.createdAt)}</span>
              </div>
              <p className="admin-status">{addressLine(selectedOrder.shippingAddress)}</p>
              <div className="admin-order-items">
                {selectedOrder.items.map((item) => (
                  <span key={item.id}>
                    {item.quantity} x {item.name} ({item.color}) - {formatCurrencyAmount(item.lineTotal, selectedOrder.currency)}
                  </span>
                ))}
              </div>
              <div className="admin-form-grid admin-form-grid-compact">
                <CustomSelect
                  label="Order status"
                  className="admin-custom-select"
                  value={orderStatus}
                  onChange={(value) => setOrderStatus(value as OrderStatus)}
                  options={orderStatuses.map((status) => ({ label: status, value: status }))}
                />
                <CustomSelect
                  label="Payment"
                  className="admin-custom-select"
                  value={paymentStatus}
                  onChange={(value) => setPaymentStatus(value as PaymentStatus)}
                  options={paymentStatuses.map((status) => ({ label: status, value: status }))}
                />
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
            <h2>Users</h2>
            <p className="admin-status admin-status-tight">
              Showing {customers.length} of {customersTotal} user records
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
            <span>User</span><span>Account</span><span>Orders</span><span>Total Spend</span><span>Newsletter</span><span>Actions</span>
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
              <span>
                <strong>{customer.hasAccount ? "Registered" : "Guest"}</strong>
                <small>{customer.accountCreatedAt ? formatDate(customer.accountCreatedAt) : "No account"}</small>
              </span>
              <span>{customer.orderCount}</span>
              <span>{customer.currency ? formatCurrencyAmount(customer.totalSpend, customer.currency) : "-"}</span>
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
            <span><strong>Account</strong>{selectedCustomer.hasAccount ? "Registered" : "Guest / contact"}</span>
            <span><strong>Account created</strong>{selectedCustomer.accountCreatedAt ? formatDate(selectedCustomer.accountCreatedAt) : "-"}</span>
            <span><strong>Active sessions</strong>{selectedCustomer.activeSessionCount}</span>
            <span><strong>Orders</strong>{selectedCustomer.orderCount}</span>
            <span><strong>Total spend</strong>{selectedCustomer.currency ? formatCurrencyAmount(selectedCustomer.totalSpend, selectedCustomer.currency) : "-"}</span>
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
                <span>{formatCurrencyAmount(order.total, order.currency)}</span>
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
          <div className="newsletter-editor-field">
            <div className="newsletter-editor-heading">
              <span>Email body</span>
              <button type="button" onClick={insertNewsletterTemplate}>Use starter layout</button>
            </div>
            <div className="newsletter-toolbar" aria-label="Email formatting toolbar">
              <button type="button" title="Heading" aria-label="Heading" onClick={() => runNewsletterCommand("formatBlock", "H2")}>
                <Heading2 size={16} />
              </button>
              <button type="button" title="Paragraph" aria-label="Paragraph" onClick={() => runNewsletterCommand("formatBlock", "P")}>
                <Pilcrow size={16} />
              </button>
              <button type="button" title="Bold" aria-label="Bold" onClick={() => runNewsletterCommand("bold")}>
                <Bold size={16} />
              </button>
              <button type="button" title="Italic" aria-label="Italic" onClick={() => runNewsletterCommand("italic")}>
                <Italic size={16} />
              </button>
              <button type="button" title="Bullet list" aria-label="Bullet list" onClick={() => runNewsletterCommand("insertUnorderedList")}>
                <List size={16} />
              </button>
              <button type="button" title="Numbered list" aria-label="Numbered list" onClick={() => runNewsletterCommand("insertOrderedList")}>
                <ListOrdered size={16} />
              </button>
              <button type="button" title="Add link" aria-label="Add link" onClick={addNewsletterLink}>
                <Link2 size={16} />
              </button>
              <button
                type="button"
                title="HTML source"
                aria-label="HTML source"
                aria-pressed={isNewsletterSourceMode}
                onClick={() => setIsNewsletterSourceMode((current) => !current)}
              >
                <Code2 size={16} />
              </button>
            </div>
            {isNewsletterSourceMode ? (
              <textarea
                value={html}
                onChange={(event) => syncNewsletterHtml(event.target.value)}
                required
              />
            ) : (
              <div
                ref={newsletterEditorRef}
                className="newsletter-wysiwyg"
                contentEditable
                role="textbox"
                aria-label="Email body"
                onInput={handleNewsletterEditorInput}
                onPaste={handleNewsletterPaste}
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
          </div>
          <label>
            Plain text fallback
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <div className="newsletter-preview">
            <span>Email preview</span>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <button type="submit" disabled={isSendingNewsletter}>
            <Send size={16} /> {isSendingNewsletter ? "Sending" : "Send to subscribers"}
          </button>
        </form>
        {newsletterMessage && <p className="admin-status">{newsletterMessage}</p>}
        {campaignResult && (
          <div className="admin-status newsletter-send-result">
            <p>
              Campaign {campaignResult.id.slice(0, 8)}: {campaignResult.sentCount}/{campaignResult.recipientCount} sent,
              {" "}{campaignResult.failedCount} failed.
            </p>
            {campaignResult.failureReasons?.length ? (
              <ul>
                {campaignResult.failureReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
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
          <form ref={collectionFormRef} className="admin-product-form admin-product-form-standalone" onSubmit={saveCollection}>
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
              <div className="admin-field-wide admin-form-stack">
                <div className="admin-media-upload">
                  <button
                    className="admin-upload-button"
                    type="button"
                    onClick={() => collectionImageInputRef.current?.click()}
                    disabled={isUploadingCollectionImage}
                  >
                    <Upload size={15} aria-hidden="true" />
                    {isUploadingCollectionImage ? "Uploading image" : collectionDraft.image ? "Replace image" : "Select image"}
                  </button>
                  <input
                    ref={collectionImageInputRef}
                    className="admin-upload-file-input"
                    type="file"
                    accept="image/*"
                    onChange={uploadCollectionImage}
                    disabled={isUploadingCollectionImage}
                  />
                  <span>{collectionDraft.image ? "Image uploaded" : "No image uploaded"}</span>
                </div>
                {collectionDraft.image && (
                  <figure className="admin-single-image-preview">
                    <img src={collectionDraft.image} alt={collectionDraft.title || "Collection preview"} />
                  </figure>
                )}
              </div>
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
                  <button type="button" onClick={() => editCollection(collection, index)}>Edit</button>
                  <button className="admin-danger" type="button" onClick={() => archiveCollection(collection.id)}>
                    <Trash2 size={14} /> Archive
                  </button>
                </div>
              </article>
            ))}
            {!collections.length && <p className="admin-empty">No collections are available yet.</p>}
          </div>
        </article>

        <article className="admin-panel admin-panel-wide">
          <div className="panel-heading">
            <div>
              <h2>Categories</h2>
              <p className="admin-status admin-status-tight">Create category options for products, edit their display order, or archive unused categories.</p>
            </div>
            <button type="button" onClick={() => setCategoryDraft(createCategoryDraft())}>
              <PackagePlus size={16} /> New category
            </button>
          </div>
          <form ref={categoryFormRef} className="admin-product-form admin-product-form-standalone" onSubmit={saveCategory}>
            <div className="admin-form-grid admin-form-grid-compact">
              <label>
                Category name
                <input
                  value={categoryDraft.name}
                  onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Jewelry"
                  required
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={categoryDraft.sortOrder}
                  onChange={(event) => setCategoryDraft((current) => ({ ...current, sortOrder: event.target.value }))}
                />
              </label>
              <div className="admin-field-wide admin-form-stack">
                <div className="admin-media-upload">
                  <button
                    className="admin-upload-button"
                    type="button"
                    onClick={() => categoryImageInputRef.current?.click()}
                    disabled={isUploadingCategoryImage}
                  >
                    <Upload size={15} aria-hidden="true" />
                    {isUploadingCategoryImage ? "Uploading image" : categoryDraft.image ? "Replace image" : "Select image"}
                  </button>
                  <input
                    ref={categoryImageInputRef}
                    className="admin-upload-file-input"
                    type="file"
                    accept="image/*"
                    onChange={uploadCategoryImage}
                    disabled={isUploadingCategoryImage}
                  />
                  <span>{categoryDraft.image ? "Image uploaded" : "No image uploaded"}</span>
                </div>
                {categoryDraft.image && (
                  <figure className="admin-single-image-preview admin-single-image-preview-compact">
                    <img src={categoryDraft.image} alt={categoryDraft.name || "Category preview"} />
                  </figure>
                )}
              </div>
            </div>
            <button type="submit">Save category</button>
          </form>
          <div className="admin-category-list">
            {categories.map((category) => (
              <div key={category.id}>
                {category.image && <img src={category.image} alt="" />}
                <span>
                  <strong>{category.name}</strong>
                  <small>Sort {category.sortOrder}</small>
                </span>
                <span className="admin-row-actions">
                  <button type="button" onClick={() => editCategory(category)}>Edit</button>
                  <button className="admin-danger" type="button" onClick={() => archiveCategory(category.id)}>
                    <Trash2 size={14} /> Archive
                  </button>
                </span>
              </div>
            ))}
            {!categories.length && <p className="admin-empty">No categories are available yet.</p>}
          </div>
          {categoryMessage && <p className="admin-status">{categoryMessage}</p>}
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
            <CustomSelect
              label="Status"
              className="admin-custom-select"
              value={conciergeFilter}
              onChange={(value) => setConciergeFilter(value as "" | ConciergeStatus)}
              options={[
                { label: "All", value: "" },
                ...conciergeStatuses.map((status) => ({ label: status, value: status })),
              ]}
            />
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
                <CustomSelect
                  label="Status"
                  className="admin-custom-select"
                  value={request.status}
                  onChange={(value) => updateConciergeRequest(request.id, { status: value as ConciergeStatus })}
                  options={conciergeStatuses.map((status) => ({ label: status, value: status }))}
                />
                <CustomSelect
                  label="Reply"
                  className="admin-custom-select"
                  value={request.replyStatus}
                  onChange={(value) => updateConciergeRequest(request.id, { replyStatus: value as ReplyStatus })}
                  options={replyStatuses.map((status) => ({ label: status, value: status }))}
                />
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
                <CustomSelect
                  label="Currency"
                  className="admin-custom-select"
                  value={settingsDraft.defaultCurrency}
                  onChange={(value) => setSettingsDraft((current) => current ? ({ ...current, defaultCurrency: value as CurrencyCode }) : current)}
                  options={currencyOptions.map((currency) => ({ label: currency, value: currency }))}
                />
                <label>
                  Market country
                  <input
                    value={settingsDraft.defaultMarketCountry}
                    maxLength={2}
                    onChange={(event) => setSettingsDraft((current) => current ? ({ ...current, defaultMarketCountry: event.target.value.toUpperCase() }) : current)}
                  />
                </label>
                <label>
                  Base shipping amount (EUR)
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
                {currencyOptions.map((currency) => (
                  <label key={currency}>
                    {currency} rate
                    <input
                      type="number"
                      min="0"
                      step={currency === "NGN" ? "1" : "0.0001"}
                      value={settingsDraft.exchangeRates?.[currency] ?? defaultExchangeRates[currency]}
                      onChange={(event) => setSettingsDraft((current) => current ? ({
                        ...current,
                        exchangeRates: {
                          ...defaultExchangeRates,
                          ...current.exchangeRates,
                          [currency]: Number(event.target.value),
                        },
                      }) : current)}
                    />
                  </label>
                ))}
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
              ["Media", settingsHealth?.media],
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
            <p className="admin-status admin-status-tight">Product, order, collection, content, concierge, settings, and password changes.</p>
          </div>
          <button type="button" onClick={readAudit}>Refresh</button>
        </div>
        {renderAuditLog()}
      </section>
    );
  }

  function renderContent() {
    const contentMetrics = [
      { label: "Planned", value: contentTotal, note: "Active content items" },
      { label: "Drafting", value: contentItems.filter((item) => item.status === "drafting").length, note: "Needs copy or assets" },
      { label: "Ready", value: contentItems.filter((item) => item.status === "ready").length, note: "Prepared for publishing" },
      { label: "Scheduled", value: contentItems.filter((item) => item.status === "scheduled").length, note: "Has a publish window" },
    ];

    return (
      <section className="admin-grid admin-grid-wide">
        <article className="admin-panel admin-panel-wide">
          <div className="panel-heading">
            <div>
              <h2>Content Planner</h2>
              <p className="admin-status admin-status-tight">Plan journal stories, homepage updates, newsletters, and social campaigns.</p>
            </div>
            <button type="button" onClick={readContent}>Refresh</button>
          </div>
          <section className="admin-metrics content-metrics">
            {contentMetrics.map((metric) => (
              <article key={metric.label}>
                <p>{metric.label}</p>
                <strong>{metric.value}</strong>
                <span>{metric.note}</span>
              </article>
            ))}
          </section>
          <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); void readContent(); }}>
            <CustomSelect
              label="Status"
              className="admin-custom-select"
              value={contentFilter}
              onChange={(value) => setContentFilter(value as "" | ContentStatus)}
              options={[
                { label: "All", value: "" },
                ...contentStatuses.map((status) => ({ label: labelize(status), value: status })),
              ]}
            />
            <button type="submit">Apply</button>
          </form>
          <div className="content-board">
            {contentItems.map((item) => (
              <article className="content-card" key={item.id}>
                <div className="content-card-main">
                  <span className="content-eyebrow">{labelize(item.contentType)} / {labelize(item.channel)}</span>
                  <h3>{item.title}</h3>
                  <p>{item.brief || "No brief added yet."}</p>
                  <div className="content-meta">
                    <span>{item.publishAt ? formatDate(item.publishAt) : "No publish date"}</span>
                    <span>{item.owner || "Unassigned"}</span>
                    {item.ctaLabel && <span>{item.ctaLabel}</span>}
                  </div>
                </div>
                <div className="content-card-actions">
                  <CustomSelect
                    label="Status"
                    className="admin-custom-select content-status-select"
                    value={item.status === "archived" ? "idea" : item.status}
                    onChange={(value) => updateContentItem(item.id, { status: value as ContentStatus })}
                    options={contentStatuses.map((status) => ({ label: labelize(status), value: status }))}
                  />
                  <button type="button" onClick={() => editContent(item)}>
                    <Edit3 size={15} /> Edit
                  </button>
                  <button className="admin-danger" type="button" onClick={() => archiveContentItem(item.id)}>
                    <Trash2 size={15} /> Archive
                  </button>
                </div>
              </article>
            ))}
            {!contentItems.length && <p className="admin-empty">{contentMessage ?? "No content items match this view yet."}</p>}
          </div>
          {contentMessage && contentItems.length > 0 && <p className="admin-status">{contentMessage}</p>}
        </article>
        <article className="admin-panel">
          <div className="panel-heading">
            <div>
              <h2>{contentDraft.id ? "Edit Content" : "New Content"}</h2>
              <p className="admin-status admin-status-tight">Create the brief before it becomes a newsletter, image request, or journal post.</p>
            </div>
          </div>
          <form className="admin-product-form content-editor-form" ref={contentFormRef} onSubmit={saveContent}>
            <label>
              Title
              <input
                value={contentDraft.title}
                onChange={(event) => setContentDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Summer travel edit"
                required
              />
            </label>
            <div className="admin-form-grid admin-form-grid-compact">
              <CustomSelect
                label="Type"
                className="admin-custom-select"
                value={contentDraft.contentType}
                onChange={(value) => setContentDraft((current) => ({ ...current, contentType: value as ContentType }))}
                options={contentTypes.map((type) => ({ label: labelize(type), value: type }))}
              />
              <CustomSelect
                label="Channel"
                className="admin-custom-select"
                value={contentDraft.channel}
                onChange={(value) => setContentDraft((current) => ({ ...current, channel: value as ContentChannel }))}
                options={contentChannels.map((channel) => ({ label: labelize(channel), value: channel }))}
              />
              <CustomSelect
                label="Status"
                className="admin-custom-select"
                value={contentDraft.status}
                onChange={(value) => setContentDraft((current) => ({ ...current, status: value as ContentStatus }))}
                options={contentStatuses.map((status) => ({ label: labelize(status), value: status }))}
              />
              <label>
                Publish date
                <input
                  type="datetime-local"
                  value={contentDraft.publishAt}
                  onChange={(event) => setContentDraft((current) => ({ ...current, publishAt: event.target.value }))}
                />
              </label>
            </div>
            <label>
              Owner
              <input
                value={contentDraft.owner}
                onChange={(event) => setContentDraft((current) => ({ ...current, owner: event.target.value }))}
                placeholder="Team member or creator"
              />
            </label>
            <label>
              Brief
              <textarea
                value={contentDraft.brief}
                onChange={(event) => setContentDraft((current) => ({ ...current, brief: event.target.value }))}
                placeholder="Goal, products to feature, assets needed, and notes for the final copy."
              />
            </label>
            <div className="admin-form-grid admin-form-grid-compact">
              <label>
                CTA label
                <input
                  value={contentDraft.ctaLabel}
                  onChange={(event) => setContentDraft((current) => ({ ...current, ctaLabel: event.target.value }))}
                  placeholder="Shop the edit"
                />
              </label>
              <label>
                CTA URL
                <input
                  type="url"
                  value={contentDraft.ctaUrl}
                  onChange={(event) => setContentDraft((current) => ({ ...current, ctaUrl: event.target.value }))}
                  placeholder="https://sekanae.co/shop"
                />
              </label>
            </div>
            <div className="admin-form-actions">
              <button type="submit">{contentDraft.id ? "Save content" : "Create content"}</button>
              <button type="button" className="admin-secondary-action" onClick={() => {
                setContentDraft(createContentDraft());
                setContentMessage(null);
              }}>
                Clear
              </button>
            </div>
          </form>
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
        <NavLink to={`${adminBase}/customers`}><Users size={18} /> Users</NavLink>
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
