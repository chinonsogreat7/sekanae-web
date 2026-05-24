import { config } from "../config.js";
import { recordEmailEvent } from "../repositories/email-event-repository.js";
import type { Order } from "./order-service.js";

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

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function money(amount: number, currency: Order["currency"]) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function orderItemsHtml(order: Order) {
  return order.items
    .map((item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #ece7df;">
          <strong>${escapeHtml(item.name)}</strong><br />
          <span style="color:#756f66;">${escapeHtml(item.color)} x ${item.quantity}</span>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #ece7df;">
          ${money(item.lineTotal, order.currency)}
        </td>
      </tr>
    `)
    .join("");
}

export function baseEmailHtml(title: string, body: string) {
  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f8f5ef;color:#231f1a;font-family:Arial,Helvetica,sans-serif;">
        <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="background:#f8f5ef;padding:32px 16px;">
          <tr>
            <td align="center">
              <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #ece7df;">
                <tr>
                  <td style="padding:28px 28px 12px;">
                    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a6f49;">Sekanae</div>
                    <h1 style="font-size:24px;line-height:1.25;margin:12px 0 0;">${escapeHtml(title)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 28px 28px;font-size:15px;line-height:1.7;">
                    ${body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function customerOrderReceivedEmail(order: Order): SendEmailInput {
  const subject = `Complete payment for your Sekanae order ${order.id}`;
  const body = `
    <p>Hello ${escapeHtml(order.customer.name)},</p>
    <p>We received your order and it is currently pending payment confirmation.</p>
    <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:20px 0;">
      ${orderItemsHtml(order)}
      <tr>
        <td style="padding:16px 0;"><strong>Total</strong></td>
        <td align="right" style="padding:16px 0;"><strong>${money(order.total, order.currency)}</strong></td>
      </tr>
    </table>
    <p>We will send another update once payment is confirmed and the order moves into processing.</p>
  `;

  return {
    orderId: order.id,
    to: order.customer.email,
    subject,
    html: baseEmailHtml("Order pending payment", body),
    text: `We received your Sekanae order ${order.id}. Total: ${money(order.total, order.currency)}. Status: ${order.status}.`,
    template: "customer_order_received",
  };
}

function customerPaymentConfirmedEmail(order: Order): SendEmailInput {
  const subject = `Your Sekanae order ${order.id} is confirmed`;
  const body = `
    <p>Hello ${escapeHtml(order.customer.name)},</p>
    <p>Your payment has been confirmed. We are preparing your order now.</p>
    <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:20px 0;">
      ${orderItemsHtml(order)}
      <tr>
        <td style="padding:16px 0;"><strong>Total paid</strong></td>
        <td align="right" style="padding:16px 0;"><strong>${money(order.total, order.currency)}</strong></td>
      </tr>
    </table>
    <p>We will email you again when fulfillment updates are available.</p>
  `;

  return {
    orderId: order.id,
    to: order.customer.email,
    subject,
    html: baseEmailHtml("Order confirmed", body),
    text: `Your Sekanae order ${order.id} is confirmed. Total paid: ${money(order.total, order.currency)}.`,
    template: "customer_payment_confirmed",
  };
}

function adminOrderCreatedEmail(order: Order, template = "admin_order_created"): SendEmailInput | undefined {
  if (!config.ADMIN_EMAIL) return undefined;

  const subject = template === "admin_order_paid" ? `Paid Sekanae order ${order.id}` : `New Sekanae order ${order.id}`;
  const body = `
    <p>${template === "admin_order_paid" ? "An order was paid." : "A new order was created."}</p>
    <p><strong>Customer:</strong> ${escapeHtml(order.customer.name)} (${escapeHtml(order.customer.email)})</p>
    <p><strong>Status:</strong> ${escapeHtml(order.status)}<br />
    <strong>Payment:</strong> ${escapeHtml(order.paymentStatus)}<br />
    <strong>Total:</strong> ${money(order.total, order.currency)}</p>
    <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:20px 0;">
      ${orderItemsHtml(order)}
    </table>
  `;

  return {
    orderId: order.id,
    to: config.ADMIN_EMAIL,
    subject,
    html: baseEmailHtml("New order", body),
    text: `New order ${order.id} from ${order.customer.name} (${order.customer.email}). Total: ${money(order.total, order.currency)}.`,
    template,
  };
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

export async function sendOrderCreatedEmails(order: Order) {
  await sendEmail(customerOrderReceivedEmail(order));

  const adminEmail = adminOrderCreatedEmail(order);

  if (adminEmail) {
    await sendEmail(adminEmail);
  }
}

export async function sendOrderPaidEmails(order: Order) {
  await sendEmail(customerPaymentConfirmedEmail(order));

  const adminEmail = adminOrderCreatedEmail(order, "admin_order_paid");

  if (adminEmail) {
    await sendEmail(adminEmail);
  }
}
