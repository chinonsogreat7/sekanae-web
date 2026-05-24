import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { ok } from "../http.js";
import { baseEmailHtml, escapeHtml, sendEmail } from "../services/email-service.js";

const conciergeRequestSchema = z.object({
  name: z.string().min(2).max(140),
  email: z.string().email(),
  topic: z.string().min(2).max(120),
  message: z.string().min(10).max(3000),
});

export async function registerConciergeRoutes(app: FastifyInstance) {
  app.post("/concierge/request", {
    schema: {
      tags: ["Client Care"],
      summary: "Send concierge request",
      body: {
        type: "object",
        required: ["name", "email", "topic", "message"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 140 },
          email: { type: "string", format: "email" },
          topic: { type: "string", minLength: 2, maxLength: 120 },
          message: { type: "string", minLength: 10, maxLength: 3000 },
        },
      },
    },
  }, async (request, reply) => {
    const payload = conciergeRequestSchema.parse(request.body);
    const recipient = config.ADMIN_EMAIL ?? config.ADMIN_LOGIN_EMAIL;

    if (!recipient) {
      return reply.status(503).send({
        error: {
          code: "CONCIERGE_EMAIL_NOT_CONFIGURED",
          message: "Concierge email is not configured.",
        },
      });
    }

    const result = await sendEmail({
      to: recipient,
      subject: `SEKANAE concierge request: ${payload.topic}`,
      template: "concierge_request",
      html: baseEmailHtml("Concierge request", `
        <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
        <p><strong>Topic:</strong> ${escapeHtml(payload.topic)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(payload.message).replaceAll("\n", "<br />")}</p>
      `),
      text: [
        `Name: ${payload.name}`,
        `Email: ${payload.email}`,
        `Topic: ${payload.topic}`,
        "",
        payload.message,
      ].join("\n"),
    });

    if (result.status === "failed") {
      return reply.status(503).send({
        error: {
          code: "CONCIERGE_SEND_FAILED",
          message: "Unable to send concierge request.",
        },
      });
    }

    return ok({
      status: result.status,
      message: "Concierge request received.",
    });
  });
}
