import { config } from "../config.js";
import { hasDatabase } from "../db/pool.js";
import {
  createNewsletterCampaign,
  finalizeNewsletterCampaign,
  getNewsletterStats,
  getSubscribedNewsletterRecipients,
  listNewsletterSubscribers,
  recordNewsletterDelivery,
  unsubscribeNewsletterSubscriber,
  upsertNewsletterSubscriber,
  type NewsletterStatus,
  type NewsletterSubscriber,
} from "../repositories/newsletter-repository.js";
import { sendEmail } from "./email-service.js";
import { emailButton, paragraph, siteUrl } from "../emails/editorial.js";
import { buildNewsletterEmail } from "../emails/templates.js";

export type SubscribeNewsletterInput = {
  email: string;
  name?: string;
  source?: string;
};

export type SendNewsletterCampaignInput = {
  subject: string;
  previewText?: string;
  html: string;
  text?: string;
};

export type SendNewsletterCampaignResult = Awaited<ReturnType<typeof finalizeNewsletterCampaign>> & {
  failureReasons: string[];
};

export class NewsletterServiceError extends Error {
  constructor(
    public readonly code: "DATABASE_REQUIRED" | "NO_SUBSCRIBERS",
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function assertDatabase() {
  if (!hasDatabase()) {
    throw new NewsletterServiceError(
      "DATABASE_REQUIRED",
      "Newsletter APIs require DATABASE_URL because subscribers and campaigns must be persisted.",
      503,
    );
  }
}

function plainTextFromHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withNewsletterFrame(input: {
  subject: string;
  previewText?: string;
  html: string;
  subscriber: NewsletterSubscriber;
  welcome?: boolean;
}) {
  return buildNewsletterEmail({
    ...input,
    email: input.subscriber.email,
    webOrigin: config.WEB_ORIGIN,
    unsubscribeUrl: `${config.API_PUBLIC_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(input.subscriber.unsubscribeToken)}`,
  });
}

function withUnsubscribeText(text: string, subscriber: NewsletterSubscriber) {
  const unsubscribeUrl = `${config.API_PUBLIC_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken)}`;
  return `${text}\n\nYou are receiving this because ${subscriber.email} opted in to SEKANAE updates.\nUnsubscribe: ${unsubscribeUrl}`;
}

async function sendNewsletterWelcomeEmail(subscriber: NewsletterSubscriber) {
  const greeting = subscriber.name ? `Hello ${subscriber.name},` : "Hello,";
  const body = paragraph(greeting)
    + paragraph("You are now subscribed to SEKANAE updates. We will send considered arrivals, edits, and client notes to this inbox.")
    + emailButton("Explore the collection", siteUrl(config.WEB_ORIGIN, "/shop"));
  const text = "You are now subscribed to SEKANAE updates. We will send considered arrivals, edits, and client notes to this inbox.";

  return sendEmail({
    to: subscriber.email,
    subject: "Welcome to SEKANAE",
    html: withNewsletterFrame({
      subject: "Welcome to SEKANAE",
      welcome: true,
      previewText: "You are now subscribed to SEKANAE updates.",
      html: body,
      subscriber,
    }),
    text: withUnsubscribeText(text, subscriber),
    template: "newsletter_welcome",
  });
}

export async function subscribeToNewsletter(input: SubscribeNewsletterInput) {
  assertDatabase();

  const subscriber = await upsertNewsletterSubscriber({
    email: input.email,
    name: input.name,
    source: input.source,
  });

  await sendNewsletterWelcomeEmail(subscriber);

  return subscriber;
}

export async function unsubscribeFromNewsletter(input: { email?: string; token?: string }) {
  assertDatabase();

  return unsubscribeNewsletterSubscriber(input);
}

export async function listNewsletterAudience(input: {
  status?: NewsletterStatus;
  limit?: number;
  offset?: number;
}) {
  assertDatabase();

  return listNewsletterSubscribers(input);
}

export async function getNewsletterAudienceStats() {
  assertDatabase();

  return getNewsletterStats();
}

export async function sendNewsletterCampaign(input: SendNewsletterCampaignInput): Promise<SendNewsletterCampaignResult> {
  assertDatabase();

  const recipients = await getSubscribedNewsletterRecipients();

  if (recipients.length === 0) {
    throw new NewsletterServiceError("NO_SUBSCRIBERS", "There are no subscribed newsletter recipients.", 409);
  }

  const textBody = input.text?.trim() || plainTextFromHtml(input.html);
  const campaign = await createNewsletterCampaign({
    subject: input.subject,
    previewText: input.previewText,
    htmlBody: input.html,
    textBody,
    recipientCount: recipients.length,
  });

  let sentCount = 0;
  let failedCount = 0;
  const failureReasons = new Set<string>();

  for (const subscriber of recipients) {
    const result = await sendEmail({
      to: subscriber.email,
      subject: input.subject,
      html: withNewsletterFrame({
        subject: input.subject,
        previewText: input.previewText,
        html: input.html,
        subscriber,
      }),
      text: withUnsubscribeText(textBody, subscriber),
      template: "newsletter_campaign",
    });

    if (result.status === "sent") {
      sentCount += 1;
    } else {
      failedCount += 1;
      if (result.errorMessage) {
        failureReasons.add(result.errorMessage);
      }
    }

    await recordNewsletterDelivery({
      campaignId: campaign.id,
      subscriberEmail: subscriber.email,
      status: result.status,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
    });
  }

  const finalizedCampaign = await finalizeNewsletterCampaign({
    campaignId: campaign.id,
    sentCount,
    failedCount,
  });

  return {
    ...finalizedCampaign,
    failureReasons: [...failureReasons],
  };
}
