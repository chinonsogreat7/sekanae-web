import { randomUUID } from "node:crypto";
import { getPool, hasDatabase } from "../db/pool.js";
import type { EmailEventInput } from "../services/email-service.js";

export async function recordEmailEvent(input: EmailEventInput) {
  if (!hasDatabase()) return;

  const pool = getPool();

  await pool.query(
    `
      insert into email_events (
        id,
        order_id,
        recipient,
        template,
        subject,
        provider,
        provider_message_id,
        status,
        error_message
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      randomUUID(),
      input.orderId,
      input.recipient,
      input.template,
      input.subject,
      input.provider ?? "resend",
      input.providerMessageId,
      input.status,
      input.errorMessage,
    ],
  );
}
