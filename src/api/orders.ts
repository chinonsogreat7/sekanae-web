import type { CurrencyCode } from "../data/catalog";
import { getApiBaseUrl } from "./config";

type ApiResponse<TData> = {
  data: TData;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
    details?: unknown;
  };
};

export type CheckoutAddress = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
};

export type CheckoutOrderItem = {
  productId: string;
  quantity: number;
  color?: string;
};

export type CheckoutOrder = {
  id: string;
  currency: CurrencyCode;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  status: "pending" | "paid" | "processing" | "fulfilled" | "cancelled" | "refunded";
  paymentStatus: "unpaid" | "requires_action" | "paid" | "failed" | "refunded";
};

export type CreateCheckoutOrderInput = {
  currency: CurrencyCode;
  customer: {
    email: string;
    name: string;
    phone?: string;
  };
  shippingAddress: CheckoutAddress;
  billingAddress?: CheckoutAddress;
  items: CheckoutOrderItem[];
  notes?: string;
  marketingOptIn?: boolean;
};

export type CheckoutSession = {
  id: string;
  url?: string | null;
};

const apiBaseUrl = getApiBaseUrl();

async function parseApiResponse<TData>(response: Response): Promise<TData> {
  const payload = await response.json() as ApiResponse<TData> & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed with status ${response.status}`);
  }

  return payload.data;
}

export async function createCheckoutOrder(input: CreateCheckoutOrderInput) {
  const response = await fetch(`${apiBaseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse<CheckoutOrder>(response);
}

export async function createCheckoutSession(orderId: string, email: string) {
  const response = await fetch(`${apiBaseUrl}/api/orders/${encodeURIComponent(orderId)}/checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  return parseApiResponse<CheckoutSession>(response);
}

export async function getCheckoutOrder(orderId: string, email: string) {
  const response = await fetch(
    `${apiBaseUrl}/api/orders/${encodeURIComponent(orderId)}?email=${encodeURIComponent(email)}`,
  );

  return parseApiResponse<CheckoutOrder>(response);
}
