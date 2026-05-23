import { config } from "./config.js";
import { buildServer } from "./server.js";

const app = await buildServer();

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
