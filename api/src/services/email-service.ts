import { config } from "../config.js";
import { recordEmailEvent } from "../repositories/email-event-repository.js";
import { listSavedCartProductSummaries } from "../repositories/customer-cart-repository.js";
import type { Order } from "./order-service.js";
import { renderEditorialEmail, section } from "../emails/editorial.js";
import { buildAdminOrderEmail, buildCustomerOrderEmail } from "../emails/templates.js";
export { escapeHtml } from "../emails/editorial.js";

export type EmailEventInput = {
  orderId?: string;
  recipient: string;
  template: string;
  subject: string;
  provider?: "resend";
  providerMessageId?: string;
  status: "sent" | "failed" | "skipped";
  errorMessage?: string;
};

export type SendEmailInput = {
  orderId?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
};

export type EmailSendResult = {
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string;
  errorMessage?: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
};

export function baseEmailHtml(title: string, body: string) {
  return renderEditorialEmail({ title, rows: section(body), webOrigin: config.WEB_ORIGIN });
}

export async function sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
  if (!config.RESEND_API_KEY) {
    await recordEmailEvent({
      orderId: input.orderId,
      recipient: input.to,
      template: input.template,
      subject: input.subject,
      status: "skipped",
      errorMessage: "RESEND_API_KEY is not configured.",
    });
    return {
      status: "skipped",
      errorMessage: "RESEND_API_KEY is not configured.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    const payload = await response.json() as ResendResponse;

    if (!response.ok) {
      throw new Error(payload.message ?? `Resend returned HTTP ${response.status}`);
    }

    await recordEmailEvent({
      orderId: input.orderId,
      recipient: input.to,
      template: input.template,
      subject: input.subject,
      providerMessageId: payload.id,
      status: "sent",
    });

    return {
      status: "sent",
      providerMessageId: payload.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown email send error.";

    await recordEmailEvent({
      orderId: input.orderId,
      recipient: input.to,
      template: input.template,
      subject: input.subject,
      status: "failed",
      errorMessage,
    });

    return {
      status: "failed",
      errorMessage,
    };
  }
}

async function orderEmailContext(order: Order) {
  // Photography is optional presentation. An unavailable catalog must never block
  // an order notification or replace an item with another product's photograph.
  let images = new Map<string, string>();
  try {
    const products = await listSavedCartProductSummaries([...new Set(order.items.map(item => item.productId))]);
    images = new Map([...products].flatMap(([id, product]) => product.image ? [[id, product.image]] : []));
  } catch { /* Fall back to the saved order's text and totals. */ }
  return { webOrigin: config.WEB_ORIGIN, images };
}

export async function sendOrderCreatedEmails(order: Order) {
  const context = await orderEmailContext(order);
  await sendEmail(buildCustomerOrderEmail(order, false, context));
  if (config.ADMIN_EMAIL) await sendEmail(buildAdminOrderEmail(order, false, config.ADMIN_EMAIL, context));
}

export async function sendOrderPaidEmails(order: Order) {
  const context = await orderEmailContext(order);
  await sendEmail(buildCustomerOrderEmail(order, true, context));
  if (config.ADMIN_EMAIL) await sendEmail(buildAdminOrderEmail(order, true, config.ADMIN_EMAIL, context));
}
