import { getApiBaseUrl } from "./config";

type ApiResponse<TData> = {
  data: TData;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

export type CustomerAuthProfile = {
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

export type CustomerAuthSession = {
  token: string;
  expiresAt: string;
  customer: CustomerAuthProfile;
};

export type RequestCustomerCodeInput = {
  email: string;
  purpose: "create" | "sign-in";
  firstName?: string;
  lastName?: string;
};

export type RequestCustomerCodeResult = {
  email: string;
  expiresAt: string;
  deliveryStatus: "sent" | "failed" | "skipped";
  devCode?: string;
};

const apiBaseUrl = getApiBaseUrl();

async function parseApiResponse<TData>(response: Response): Promise<TData> {
  const payload = await response.json() as ApiResponse<TData> & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed with status ${response.status}`);
  }

  return payload.data;
}

export async function requestCustomerCode(input: RequestCustomerCodeInput) {
  const response = await fetch(`${apiBaseUrl}/api/customer/auth/request-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse<RequestCustomerCodeResult>(response);
}

export async function verifyCustomerCode(input: { email: string; code: string }) {
  const response = await fetch(`${apiBaseUrl}/api/customer/auth/verify-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse<CustomerAuthSession>(response);
}

export async function validateCustomerSession(token: string) {
  const response = await fetch(`${apiBaseUrl}/api/customer/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  return parseApiResponse<CustomerAuthSession>(response);
}

export async function signOutCustomerSession(token: string) {
  const response = await fetch(`${apiBaseUrl}/api/customer/auth/sign-out`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  return parseApiResponse<{ signedOut: boolean }>(response);
}
