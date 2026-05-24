import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

const distDir = new URL("../dist/", import.meta.url);
const indexPath = new URL("index.html", distDir);
const routePaths = [
  "admin",
  "admin/products",
  "admin/products/new",
  "admin/collections",
  "admin/orders",
  "admin/customers",
  "admin/concierge",
  "admin/newsletter",
  "admin/content",
  "admin/markets",
  "admin/settings",
  "admin/audit",
  "sekanae-studio",
  "sekanae-studio/products",
  "sekanae-studio/products/new",
  "sekanae-studio/collections",
  "sekanae-studio/orders",
  "sekanae-studio/customers",
  "sekanae-studio/concierge",
  "sekanae-studio/newsletter",
  "sekanae-studio/content",
  "sekanae-studio/markets",
  "sekanae-studio/settings",
  "sekanae-studio/audit",
  "shop",
  "collections",
  "lookbook",
  "about",
  "cart",
  "checkout",
  "client-care",
  "bridal",
  "shipping",
  "returns",
  "privacy",
];

await copyFile(indexPath, new URL("404.html", distDir));

await Promise.all(routePaths.map(async (routePath) => {
  const routeDir = join(distDir.pathname, routePath);
  await mkdir(routeDir, { recursive: true });
  await copyFile(indexPath, join(routeDir, "index.html"));
}));
