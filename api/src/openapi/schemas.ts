import { categories } from "../../../packages/catalog/src/index.js";

const currencyValues = ["USD", "GBP", "EUR", "NGN", "AED"] as const;

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: { type: "object", additionalProperties: true },
      },
    },
  },
} as const;

const productSchema = {
  type: "object",
  required: [
    "id",
    "slug",
    "name",
    "category",
    "collection",
    "price",
    "colors",
    "material",
    "occasion",
    "images",
    "description",
    "details",
    "rating",
    "reviews",
    "stock",
  ],
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    name: { type: "string" },
    category: { type: "string", enum: categories },
    collection: { type: "string" },
    price: { type: "number", minimum: 0 },
    colors: { type: "array", items: { type: "string" } },
    material: { type: "string" },
    occasion: { type: "array", items: { type: "string" } },
    images: { type: "array", items: { type: "string", format: "uri" } },
    description: { type: "string" },
    details: {
      type: "object",
      required: ["materials", "dimensions", "care", "shipping"],
      properties: {
        materials: { type: "string" },
        dimensions: { type: "string" },
        care: { type: "string" },
        shipping: { type: "string" },
      },
    },
    rating: { type: "number", minimum: 0, maximum: 5 },
    reviews: { type: "integer", minimum: 0 },
    stock: { type: "integer", minimum: 0 },
    isNew: { type: "boolean" },
    isBridalPreview: { type: "boolean" },
  },
} as const;

const collectionSchema = {
  type: "object",
  required: ["id", "title", "description", "image", "cta"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    image: { type: "string", format: "uri" },
    cta: { type: "string" },
  },
} as const;

const idParamsSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", minLength: 1 },
  },
} as const;

const productListMetaSchema = {
  type: "object",
  required: ["total", "limit", "offset", "categories", "colors", "materials", "occasions"],
  properties: {
    total: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
    categories: { type: "array", items: { type: "string", enum: categories } },
    colors: { type: "array", items: { type: "string" } },
    materials: { type: "array", items: { type: "string" } },
    occasions: { type: "array", items: { type: "string" } },
  },
} as const;

const validatedCartItemSchema = {
  type: "object",
  required: [
    "productId",
    "slug",
    "name",
    "color",
    "quantity",
    "unitPrice",
    "lineTotal",
    "availableQuantity",
    "isAvailable",
  ],
  properties: {
    productId: { type: "string" },
    slug: { type: "string" },
    name: { type: "string" },
    color: { type: "string" },
    quantity: { type: "integer", minimum: 1 },
    unitPrice: { type: "number", minimum: 0 },
    lineTotal: { type: "number", minimum: 0 },
    availableQuantity: { type: "integer", minimum: 0 },
    isAvailable: { type: "boolean" },
    message: { type: "string" },
  },
} as const;

const addressSchema = {
  type: "object",
  required: ["line1", "city", "country"],
  properties: {
    line1: { type: "string", minLength: 1 },
    line2: { type: "string", minLength: 1 },
    city: { type: "string", minLength: 1 },
    region: { type: "string", minLength: 1 },
    postalCode: { type: "string", minLength: 1 },
    country: { type: "string", minLength: 2 },
  },
} as const;

const orderItemSchema = {
  type: "object",
  required: ["id", "productId", "slug", "name", "color", "quantity", "unitPrice", "lineTotal"],
  properties: {
    id: { type: "string" },
    productId: { type: "string" },
    slug: { type: "string" },
    name: { type: "string" },
    color: { type: "string" },
    quantity: { type: "integer", minimum: 1 },
    unitPrice: { type: "number", minimum: 0 },
    lineTotal: { type: "number", minimum: 0 },
  },
} as const;

const orderStatusValues = ["pending", "paid", "processing", "fulfilled", "cancelled", "refunded"] as const;
const paymentStatusValues = ["unpaid", "requires_action", "paid", "failed", "refunded"] as const;

const orderSchema = {
  type: "object",
  required: [
    "id",
    "customer",
    "currency",
    "subtotal",
    "shipping",
    "tax",
    "total",
    "taxRate",
    "taxIncluded",
    "status",
    "paymentStatus",
    "shippingAddress",
    "items",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    customer: {
      type: "object",
      required: ["email", "name"],
      properties: {
        email: { type: "string", format: "email" },
        name: { type: "string" },
        phone: { type: "string" },
      },
    },
    currency: { type: "string", enum: currencyValues },
    subtotal: { type: "number", minimum: 0 },
    shipping: { type: "number", minimum: 0 },
    tax: { type: "number", minimum: 0 },
    total: { type: "number", minimum: 0 },
    taxRate: { type: "number", minimum: 0, maximum: 1 },
    taxIncluded: { type: "boolean" },
    status: { type: "string", enum: orderStatusValues },
    paymentStatus: { type: "string", enum: paymentStatusValues },
    paymentProvider: { type: "string" },
    paymentReference: { type: "string" },
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    notes: { type: "string" },
    items: { type: "array", items: orderItemSchema },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const adminProductBodySchema = {
  type: "object",
  required: [
    "id",
    "slug",
    "name",
    "category",
    "collection",
    "price",
    "colors",
    "material",
    "occasion",
    "images",
    "description",
    "details",
  ],
  properties: {
    ...productSchema.properties,
  },
} as const;

const adminCollectionBodySchema = {
  type: "object",
  required: ["id", "title", "description", "image", "cta"],
  properties: {
    ...collectionSchema.properties,
    sortOrder: { type: "integer", minimum: 0, default: 0 },
  },
} as const;

export const openApiSchemas = {
  error: errorSchema,
  product: productSchema,
  collection: collectionSchema,
  idParams: idParamsSchema,
  productListResponse: {
    type: "object",
    required: ["data", "meta"],
    properties: {
      data: { type: "array", items: productSchema },
      meta: productListMetaSchema,
    },
  },
  productResponse: {
    type: "object",
    required: ["data"],
    properties: {
      data: productSchema,
    },
  },
  collectionsResponse: {
    type: "object",
    required: ["data"],
    properties: {
      data: { type: "array", items: collectionSchema },
    },
  },
  collectionResponse: {
    type: "object",
    required: ["data"],
    properties: {
      data: collectionSchema,
    },
  },
  cartValidationBody: {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        maxItems: 50,
        items: {
          type: "object",
          required: ["productId", "quantity"],
          properties: {
            productId: { type: "string", minLength: 1 },
            quantity: { type: "integer", minimum: 1, maximum: 99 },
            color: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
  cartValidationResponse: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["currency", "subtotal", "items", "canCheckout"],
        properties: {
          currency: { type: "string", enum: currencyValues },
          subtotal: { type: "number", minimum: 0 },
          items: { type: "array", items: validatedCartItemSchema },
          canCheckout: { type: "boolean" },
        },
      },
    },
  },
  createOrderBody: {
    type: "object",
    required: ["customer", "shippingAddress", "items"],
    properties: {
      customer: {
        type: "object",
        required: ["email", "name"],
        properties: {
          email: { type: "string", format: "email" },
          name: { type: "string", minLength: 1 },
          phone: { type: "string", minLength: 1 },
        },
      },
      shippingAddress: addressSchema,
      billingAddress: addressSchema,
      items: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        items: {
          type: "object",
          required: ["productId", "quantity"],
          properties: {
            productId: { type: "string", minLength: 1 },
            quantity: { type: "integer", minimum: 1, maximum: 99 },
            color: { type: "string", minLength: 1 },
          },
        },
      },
      notes: { type: "string", maxLength: 1000 },
      marketingOptIn: { type: "boolean" },
    },
  },
  order: orderSchema,
  checkoutSessionBody: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", format: "email" },
    },
  },
  checkoutSessionResponse: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["id", "url"],
        properties: {
          id: { type: "string" },
          url: { type: "string", format: "uri" },
        },
      },
    },
  },
  webhookAckResponse: {
    type: "object",
    required: ["received"],
    properties: {
      received: { type: "boolean" },
    },
  },
  orderResponse: {
    type: "object",
    required: ["data"],
    properties: {
      data: orderSchema,
    },
  },
  orderListResponse: {
    type: "object",
    required: ["data", "meta"],
    properties: {
      data: { type: "array", items: orderSchema },
      meta: {
        type: "object",
        required: ["total", "limit", "offset"],
        properties: {
          total: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1 },
          offset: { type: "integer", minimum: 0 },
        },
      },
    },
  },
  adminProductBody: adminProductBodySchema,
  adminCollectionBody: adminCollectionBodySchema,
  adminOrderUpdateBody: {
    type: "object",
    properties: {
      status: { type: "string", enum: orderStatusValues },
      paymentStatus: { type: "string", enum: paymentStatusValues },
      paymentProvider: { type: "string", minLength: 1 },
      paymentReference: { type: "string", minLength: 1 },
      notes: { type: "string", maxLength: 1000 },
    },
    additionalProperties: false,
  },
  adminInventoryBody: {
    type: "object",
    required: ["quantity"],
    properties: {
      quantity: { type: "integer", minimum: 0 },
    },
  },
  adminArchiveResponse: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["archived"],
        properties: {
          archived: { type: "boolean" },
        },
      },
    },
  },
} as const;
