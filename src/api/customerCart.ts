import type { CartItem } from "../context/store-types";
import type { CurrencyCode } from "../data/catalog";
import { getApiBaseUrl } from "./config";

type ApiResponse<TData> = {
  data: TData;
};

type CustomerCartPayload = {
  currency: CurrencyCode;
  items: CartItem[];
};

const apiBaseUrl = getApiBaseUrl();

async function parseCartResponse(response: Response): Promise<CustomerCartPayload> {
  const payload = await response.json() as ApiResponse<CustomerCartPayload> & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed with status ${response.status}`);
  }

  return payload.data;
}

export async function getCustomerCart(token: string) {
  const response = await fetch(`${apiBaseUrl}/api/customer/cart`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseCartResponse(response);
}

export async function replaceCustomerCart(token: string, currency: CurrencyCode, items: CartItem[]) {
  const response = await fetch(`${apiBaseUrl}/api/customer/cart`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currency, items }),
  });

  return parseCartResponse(response);
}

export async function clearCustomerCart(token: string) {
  const response = await fetch(`${apiBaseUrl}/api/customer/cart`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseCartResponse(response);
}
