export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    // Vite proxies local API requests, so both preview hostnames use the same
    // origin and do not depend on API CORS or localhost's IPv4/IPv6 resolution.
    return "";
  }

  return "https://sekanae-api.onrender.com";
}
