import { createAdminPasswordHash } from "../src/auth/admin.js";

const password = process.argv[2];

if (!password || password.length < 12) {
  console.error("Usage: npm run admin:password-hash -- <password-at-least-12-characters>");
  process.exit(1);
}

console.log(createAdminPasswordHash(password));
