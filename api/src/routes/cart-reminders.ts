import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { suppressCartRemindersByToken } from "../repositories/customer-cart-repository.js";

const unsubscribeQuerySchema = z.object({
  token: z.string().uuid(),
});

export async function registerCartReminderRoutes(app: FastifyInstance) {
  app.get("/cart/reminders/unsubscribe", {
    schema: {
      tags: ["Cart"],
      summary: "Unsubscribe from abandoned cart reminders",
      querystring: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    const { token } = unsubscribeQuerySchema.parse(request.query);
    const email = await suppressCartRemindersByToken(token);
    const title = email ? "You are unsubscribed" : "Link expired";
    const message = email
      ? "We will no longer send reminders about your saved SEKANAE cart."
      : "This reminder link is no longer available.";

    return reply.type("text/html").send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>${title}</title>
        </head>
        <body style="margin:0;background:#fbf7f2;color:#251d1a;font-family:Arial,Helvetica,sans-serif;">
          <main style="max-width:620px;margin:80px auto;padding:38px 28px;background:#fff;border:1px solid #e8ded4;">
            <p style="letter-spacing:3px;text-transform:uppercase;color:#ad7d39;font-size:12px;font-weight:700;">SEKANAE</p>
            <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:42px;margin:12px 0;">${title}</h1>
            <p style="font-size:18px;line-height:1.7;color:#675950;">${message}</p>
            <a href="${config.WEB_ORIGIN}" style="display:inline-block;margin-top:24px;background:#050505;color:#fff;text-decoration:none;padding:16px 22px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Return to SEKANAE</a>
          </main>
        </body>
      </html>
    `);
  });
}
