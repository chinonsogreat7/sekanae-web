import Stripe from "stripe";
import { config } from "../config.js";
import { getOrderForCustomer, updateOrder, type Order } from "./order-service.js";
import { sendOrderPaidEmails } from "./email-service.js";
import { completeStripePaymentInDatabase } from "../repositories/payment-repository.js";

export class PaymentServiceError extends Error {
  constructor(
    public readonly code:
      | "STRIPE_NOT_CONFIGURED"
      | "ORDER_NOT_FOUND"
      | "ORDER_NOT_PAYABLE"
      | "CHECKOUT_SESSION_NOT_FOUND"
      | "CHECKOUT_SESSION_NOT_PAID"
      | "WEBHOOK_SECRET_REQUIRED"
      | "WEBHOOK_VERIFICATION_FAILED",
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function getStripe() {
  if (!config.STRIPE_SECRET_KEY) {
    throw new PaymentServiceError("STRIPE_NOT_CONFIGURED", "STRIPE_SECRET_KEY is not configured.", 503);
  }

  return new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia",
  });
}

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function isPayable(order: Order) {
  return order.status === "pending" && order.paymentStatus !== "paid";
}

export async function createCheckoutSession(orderId: string, email: string) {
  const order = await getOrderForCustomer(orderId, email);

  if (!order) {
    throw new PaymentServiceError("ORDER_NOT_FOUND", "Order not found.", 404);
  }

  if (!isPayable(order)) {
    throw new PaymentServiceError("ORDER_NOT_PAYABLE", "This order is not available for checkout.", 409);
  }

  const stripe = getStripe();
  const lineItems = order.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: order.currency.toLowerCase(),
      unit_amount: toCents(item.unitPrice),
      product_data: {
        name: item.name,
        metadata: {
          productId: item.productId,
          color: item.color,
        },
      },
    },
  }));

  if (order.shipping > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: order.currency.toLowerCase(),
        unit_amount: toCents(order.shipping),
        product_data: {
          name: "Shipping",
          metadata: {
            productId: "shipping",
            color: "",
          },
        },
      },
    });
  }

  if (!order.taxIncluded && order.tax > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: order.currency.toLowerCase(),
        unit_amount: toCents(order.tax),
        product_data: {
          name: "VAT",
          metadata: {
            productId: "vat",
            color: "",
          },
        },
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: order.customer.email,
    client_reference_id: order.id,
    metadata: {
      orderId: order.id,
    },
    line_items: lineItems,
    success_url: config.STRIPE_SUCCESS_URL,
    cancel_url: config.STRIPE_CANCEL_URL,
  });

  await updateOrder(order.id, {
    paymentStatus: "requires_action",
    paymentProvider: "stripe",
    paymentReference: session.id,
  });

  return {
    id: session.id,
    url: session.url,
  };
}

export async function confirmCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    throw new PaymentServiceError("CHECKOUT_SESSION_NOT_FOUND", "Checkout session not found.", 404);
  }

  const orderId = session.metadata?.orderId ?? session.client_reference_id ?? undefined;

  if (!orderId) {
    throw new PaymentServiceError("CHECKOUT_SESSION_NOT_FOUND", "Checkout session is not linked to an order.", 404);
  }

  if (session.payment_status !== "paid") {
    throw new PaymentServiceError("CHECKOUT_SESSION_NOT_PAID", "Checkout payment is not confirmed yet.", 409);
  }

  const result = await completeStripePaymentInDatabase({
    eventId: `checkout-session:${session.id}`,
    eventType: "checkout.session.success_return",
    orderId,
    paymentReference: session.id,
  });

  if (result.order && !result.alreadyProcessed) {
    await sendOrderPaidEmails(result.order);
  }

  if (!result.order) {
    throw new PaymentServiceError("ORDER_NOT_FOUND", "Order not found.", 404);
  }

  return result.order;
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  if (!config.STRIPE_WEBHOOK_SECRET) {
    throw new PaymentServiceError("WEBHOOK_SECRET_REQUIRED", "STRIPE_WEBHOOK_SECRET is not configured.", 503);
  }

  if (!signature) {
    throw new PaymentServiceError("WEBHOOK_VERIFICATION_FAILED", "Stripe signature is missing.", 400);
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new PaymentServiceError("WEBHOOK_VERIFICATION_FAILED", "Stripe webhook signature verification failed.", 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (orderId && session.payment_status === "paid") {
      const result = await completeStripePaymentInDatabase({
        eventId: event.id,
        eventType: event.type,
        orderId,
        paymentReference: session.id,
      });

      if (result.order && !result.alreadyProcessed) {
        await sendOrderPaidEmails(result.order);
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      await updateOrder(orderId, {
        paymentStatus: "failed",
        paymentProvider: "stripe",
        paymentReference: session.id,
      });
    }
  }

  return { received: true };
}
