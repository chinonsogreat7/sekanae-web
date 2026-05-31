import { getApiBaseUrl } from "./config";

type ApiResponse<TData> = {
  data: TData;
};

type WishlistPayload = {
  productIds: string[];
};

const apiBaseUrl = getApiBaseUrl();

async function parseWishlistResponse(response: Response): Promise<WishlistPayload> {
  const payload = await response.json() as ApiResponse<WishlistPayload> & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed with status ${response.status}`);
  }

  return payload.data;
}

export async function getCustomerWishlist(token: string) {
  const response = await fetch(`${apiBaseUrl}/api/customer/wishlist`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseWishlistResponse(response);
}

export async function replaceCustomerWishlist(token: string, productIds: string[]) {
  const response = await fetch(`${apiBaseUrl}/api/customer/wishlist`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productIds }),
  });

  return parseWishlistResponse(response);
}
