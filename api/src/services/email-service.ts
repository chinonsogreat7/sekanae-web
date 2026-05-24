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
        <td style="padding:18px 0;border-bottom:1px solid #eadbd5;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.25;color:#2f2420;">${escapeHtml(item.name)}</div>
          <div style="margin-top:6px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#a66f67;">${escapeHtml(item.color)} / Qty ${item.quantity}</div>
        </td>
        <td align="right" style="padding:18px 0;border-bottom:1px solid #eadbd5;font-weight:700;color:#2f2420;">
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
      <body style="margin:0;background:#fbf1ee;color:#2f2420;font-family:Arial,Helvetica,sans-serif;">
        <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="background:#fbf1ee;padding:34px 14px;">
          <tr>
            <td align="center">
              <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdfb;border:1px solid #eadbd5;">
                <tr>
                  <td style="background:#2f2420;padding:18px 28px;text-align:center;">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:10px;text-transform:uppercase;color:#e8b8ae;">SEKANAE</div>
                    <div style="margin-top:8px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#fbf1ee;">Luxury accessories for women of the world</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 36px 10px;">
                    <div style="width:46px;height:1px;background:#e8b8ae;margin-bottom:22px;"></div>
                    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:38px;font-weight:400;line-height:1.04;margin:0;color:#2f2420;">${escapeHtml(title)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 36px 34px;font-size:15px;line-height:1.75;color:#5c4b45;">
                    ${body}
                  </td>
                </tr>
                <tr>
                  <td style="background:#fff7f3;padding:24px 36px;border-top:1px solid #eadbd5;">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.35;color:#2f2420;">With care from the SEKANAE studio.</div>
                    <div style="margin-top:10px;font-size:11px;line-height:1.7;color:#7f6b63;">
                      We send service emails for orders, payments, concierge requests, and subscribed updates.
                      For support, reply to this email or visit sekanae.co.
                    </div>
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
    <p style="margin:0 0 14px;">Hello ${escapeHtml(order.customer.name)},</p>
    <p style="margin:0 0 20px;">We received your order and reserved the selected pieces while payment is completed.</p>
    <div style="background:#fff7f3;border:1px solid #eadbd5;padding:16px 18px;margin:22px 0;">
      <div style="font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#a66f67;">Order reference</div>
      <div style="margin-top:6px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#2f2420;">${escapeHtml(order.id)}</div>
    </div>
    <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0;">
      ${orderItemsHtml(order)}
      <tr>
        <td style="padding:20px 0;font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#a66f67;"><strong>Total</strong></td>
        <td align="right" style="padding:20px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#2f2420;"><strong>${money(order.total, order.currency)}</strong></td>
      </tr>
    </table>
    <div style="background:#fbf1ee;padding:16px 18px;margin:20px 0;color:#6b5851;">
      Your pieces will be prepared with care, wrapped beautifully, and handled by our studio before dispatch.
    </div>
    <p style="margin:18px 0 0;">We will send another update once payment is confirmed and the order moves into preparation.</p>
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
    <p style="margin:0 0 14px;">Hello ${escapeHtml(order.customer.name)},</p>
    <p style="margin:0 0 20px;">Your payment has been confirmed. We are preparing your SEKANAE order now.</p>
    <div style="background:#2f2420;color:#fff;padding:18px 20px;margin:22px 0;">
      <div style="font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#e8b8ae;">Confirmed order</div>
      <div style="margin-top:6px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#fff;">${escapeHtml(order.id)}</div>
    </div>
    <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0;">
      ${orderItemsHtml(order)}
      <tr>
        <td style="padding:20px 0;font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#a66f67;"><strong>Total paid</strong></td>
        <td align="right" style="padding:20px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#2f2420;"><strong>${money(order.total, order.currency)}</strong></td>
      </tr>
    </table>
    <div style="background:#fff7f3;border:1px solid #eadbd5;padding:16px 18px;margin:20px 0;color:#6b5851;">
      A studio note will follow when your order is ready to travel.
    </div>
    <p style="margin:18px 0 0;">We will email you again when fulfillment updates are available.</p>
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
    <p style="margin:0 0 18px;">${template === "admin_order_paid" ? "An order was paid." : "A new order was created."}</p>
    <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fff7f3;border:1px solid #eadbd5;margin:18px 0 24px;">
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid #eadbd5;color:#7f6b63;">Customer</td>
        <td style="padding:14px 16px;border-bottom:1px solid #eadbd5;text-align:right;color:#2f2420;"><strong>${escapeHtml(order.customer.name)}</strong><br />${escapeHtml(order.customer.email)}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid #eadbd5;color:#7f6b63;">Status</td>
        <td style="padding:14px 16px;border-bottom:1px solid #eadbd5;text-align:right;color:#2f2420;">${escapeHtml(order.status)} / ${escapeHtml(order.paymentStatus)}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;color:#7f6b63;">Total</td>
        <td style="padding:14px 16px;text-align:right;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#2f2420;">${money(order.total, order.currency)}</td>
      </tr>
    </table>
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
