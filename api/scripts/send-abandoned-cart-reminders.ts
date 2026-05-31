import { closePool } from "../src/db/pool.js";
import { sendAbandonedCartReminders } from "../src/services/abandoned-cart-service.js";

try {
  const result = await sendAbandonedCartReminders({ limit: 50 });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await closePool();
}
