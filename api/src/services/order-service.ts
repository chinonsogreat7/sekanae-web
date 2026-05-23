import { hasDatabase } from "../db/pool.js";
import {
  createOrderInDatabase,
  getOrderByIdFromDatabase,
  getOrderForCustomerFromDatabase,
  listOrdersFromDatabase,
  updateOrderInDatabase,
} from "../repositories/order-repository.js";
import { validateCart, type CartValidationInput, type ValidatedCartItem } from "./cart-service.js";
import { sendOrderCreatedEmails } from "./email-service.js";
import { calculateOrderPricing, type CurrencyCode } from "./pricing-service.js";

export type OrderStatus = "pending" | "paid" | "processing" | "fulfilled" | "cancelled" | "refunded";
export type PaymentStatus = "unpaid" | "requires_action" | "paid" | "failed" | "refunded";

export type AddressInput = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
};

export type CustomerInput = {
  email: string;
  name: string;
  phone?: string;
};

export type CreateOrderRequest = {
  customer: CustomerInput;
  shippingAddress: AddressInput;
  billingAddress?: AddressInput;
  items: CartValidationInput["items"];
  notes?: string;
};

export type CreateOrderInput = {
  customer: CustomerInput;
  shippingAddress: AddressInput;
  billingAddress?: AddressInput;
  notes?: string;
  currency: CurrencyCode;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  taxRate: number;
  taxIncluded: boolean;
  items: ValidatedCartItem[];
};

export type OrderItem = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  customer: CustomerInput;
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
  shippingAddress: AddressInput;
  billingAddress?: AddressInput;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type OrderListFilters = {
  status?: OrderStatus;
  email?: string;
  limit?: number;
  offset?: number;
};

export type UpdateOrderInput = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentProvider?: string;
  paymentReference?: string;
  notes?: string;
};

export class OrderServiceError extends Error {
  constructor(
    public readonly code: "DATABASE_REQUIRED" | "CART_NOT_CHECKOUT_READY",
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function createOrder(request: CreateOrderRequest): Promise<Order> {
  if (!hasDatabase()) {
    throw new OrderServiceError("DATABASE_REQUIRED", "Order APIs require DATABASE_URL because orders must be persisted.", 503);
  }

  const cart = await validateCart({ items: request.items });

  if (!cart.canCheckout) {
    throw new OrderServiceError(
      "CART_NOT_CHECKOUT_READY",
      "One or more cart items are unavailable.",
      409,
      { items: cart.items },
    );
  }

  const pricing = calculateOrderPricing(cart.subtotal);

  const order = await createOrderInDatabase({
    customer: request.customer,
    shippingAddress: request.shippingAddress,
    billingAddress: request.billingAddress,
    notes: request.notes,
    currency: pricing.currency,
    subtotal: pricing.subtotal,
    shipping: pricing.shipping,
    tax: pricing.tax,
    total: pricing.total,
    taxRate: pricing.taxRate,
    taxIncluded: pricing.taxIncluded,
    items: cart.items,
  });

  await sendOrderCreatedEmails(order);

  return order;
}

export async function getOrderForCustomer(orderId: string, email: string): Promise<Order | undefined> {
  if (!hasDatabase()) {
    throw new OrderServiceError("DATABASE_REQUIRED", "Order APIs require DATABASE_URL because orders must be persisted.", 503);
  }

  return getOrderForCustomerFromDatabase(orderId, email);
}

export async function getOrderById(orderId: string): Promise<Order | undefined> {
  return getOrderByIdFromDatabase(orderId);
}

export async function listOrders(filters: OrderListFilters): Promise<{ items: Order[]; total: number }> {
  return listOrdersFromDatabase(filters);
}

export async function updateOrder(orderId: string, input: UpdateOrderInput): Promise<Order | undefined> {
  return updateOrderInDatabase(orderId, input);
}
