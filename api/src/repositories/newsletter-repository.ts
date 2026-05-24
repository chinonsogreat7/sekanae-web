import { randomBytes, randomUUID } from "node:crypto";
import { getPool } from "../db/pool.js";

export type NewsletterStatus = "subscribed" | "unsubscribed";
export type NewsletterDeliveryStatus = "sent" | "failed" | "skipped";

export type NewsletterSubscriber = {
  email: string;
  name?: string;
  status: NewsletterStatus;
  source: string;
  unsubscribeToken: string;
  consentedAt: string;
  unsubscribedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type NewsletterCampaign = {
  id: string;
  subject: string;
  previewText?: string;
  htmlBody: string;
  textBody: string;
  status: "draft" | "sending" | "sent" | "failed";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sentAt?: string;
};

type SubscriberRow = {
  email: string;
  name: string | null;
  status: NewsletterStatus;
  source: string;
  unsubscribe_token: string;
  consented_at: Date;
  unsubscribed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type CampaignRow = {
  id: string;
  subject: string;
  preview_text: string | null;
  html_body: string;
  text_body: string;
  status: NewsletterCampaign["status"];
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: Date;
  sent_at: Date | null;
};

function createUnsubscribeToken() {
  return randomBytes(32).toString("hex");
}

function mapSubscriber(row: SubscriberRow): NewsletterSubscriber {
  return {
    email: row.email,
    name: row.name ?? undefined,
    status: row.status,
    source: row.source,
    unsubscribeToken: row.unsubscribe_token,
    consentedAt: row.consented_at.toISOString(),
    unsubscribedAt: row.unsubscribed_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapCampaign(row: CampaignRow): NewsletterCampaign {
  return {
    id: row.id,
    subject: row.subject,
    previewText: row.preview_text ?? undefined,
    htmlBody: row.html_body,
    textBody: row.text_body,
    status: row.status,
    recipientCount: row.recipient_count,
    sentCount: row.sent_count,
    failedCount: row.failed_count,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at?.toISOString(),
  };
}

export async function upsertNewsletterSubscriber(input: {
  email: string;
  name?: string;
  source?: string;
}): Promise<NewsletterSubscriber> {
  const pool = getPool();
  const result = await pool.query<SubscriberRow>(
    `
      insert into newsletter_subscribers (
        email,
        name,
        source,
        unsubscribe_token,
        status,
        consented_at,
        unsubscribed_at
      )
      values ($1, $2, $3, $4, 'subscribed', now(), null)
      on conflict (email) do update
      set
        name = coalesce(excluded.name, newsletter_subscribers.name),
        source = excluded.source,
        status = 'subscribed',
        consented_at = now(),
        unsubscribed_at = null,
        updated_at = now()
      returning *
    `,
    [
      input.email.toLowerCase(),
      input.name,
      input.source ?? "storefront",
      createUnsubscribeToken(),
    ],
  );

  return mapSubscriber(result.rows[0]);
}

export async function unsubscribeNewsletterSubscriber(input: {
  email?: string;
  token?: string;
}): Promise<NewsletterSubscriber | undefined> {
  const pool = getPool();
  const result = await pool.query<SubscriberRow>(
    `
      update newsletter_subscribers
      set
        status = 'unsubscribed',
        unsubscribed_at = now(),
        updated_at = now()
      where ($1::text is not null and lower(email) = lower($1))
        or ($2::text is not null and unsubscribe_token = $2)
      returning *
    `,
    [input.email, input.token],
  );

  return result.rows[0] ? mapSubscriber(result.rows[0]) : undefined;
}

export async function listNewsletterSubscribers(input: {
  status?: NewsletterStatus;
  limit?: number;
  offset?: number;
}): Promise<{ items: NewsletterSubscriber[]; total: number }> {
  const pool = getPool();
  const values: Array<string | number> = [];
  const where: string[] = [];

  if (input.status) {
    values.push(input.status);
    where.push(`status = $${values.length}`);
  }

  const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const countResult = await pool.query<{ total: string }>(
    `select count(*)::text as total from newsletter_subscribers ${whereSql}`,
    values,
  );

  const subscriberResult = await pool.query<SubscriberRow>(
    `
      select *
      from newsletter_subscribers
      ${whereSql}
      order by created_at desc
      limit $${values.length + 1}
      offset $${values.length + 2}
    `,
    [...values, limit, offset],
  );

  return {
    items: subscriberResult.rows.map(mapSubscriber),
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function getNewsletterStats() {
  const pool = getPool();
  const result = await pool.query<{
    subscribed: string;
    unsubscribed: string;
    campaigns: string;
  }>(
    `
      select
        count(*) filter (where status = 'subscribed')::text as subscribed,
        count(*) filter (where status = 'unsubscribed')::text as unsubscribed,
        (select count(*)::text from newsletter_campaigns) as campaigns
      from newsletter_subscribers
    `,
  );

  const row = result.rows[0];

  return {
    subscribed: Number(row?.subscribed ?? 0),
    unsubscribed: Number(row?.unsubscribed ?? 0),
    campaigns: Number(row?.campaigns ?? 0),
  };
}

export async function getSubscribedNewsletterRecipients(): Promise<NewsletterSubscriber[]> {
  const pool = getPool();
  const result = await pool.query<SubscriberRow>(
    `
      select *
      from newsletter_subscribers
      where status = 'subscribed'
      order by created_at asc
    `,
  );

  return result.rows.map(mapSubscriber);
}

export async function createNewsletterCampaign(input: {
  subject: string;
  previewText?: string;
  htmlBody: string;
  textBody: string;
  recipientCount: number;
}): Promise<NewsletterCampaign> {
  const pool = getPool();
  const result = await pool.query<CampaignRow>(
    `
      insert into newsletter_campaigns (
        id,
        subject,
        preview_text,
        html_body,
        text_body,
        status,
        recipient_count
      )
      values ($1, $2, $3, $4, $5, 'sending', $6)
      returning *
    `,
    [
      randomUUID(),
      input.subject,
      input.previewText,
      input.htmlBody,
      input.textBody,
      input.recipientCount,
    ],
  );

  return mapCampaign(result.rows[0]);
}

export async function recordNewsletterDelivery(input: {
  campaignId: string;
  subscriberEmail: string;
  status: NewsletterDeliveryStatus;
  providerMessageId?: string;
  errorMessage?: string;
}) {
  const pool = getPool();

  await pool.query(
    `
      insert into newsletter_deliveries (
        id,
        campaign_id,
        subscriber_email,
        status,
        provider_message_id,
        error_message
      )
      values ($1, $2, $3, $4, $5, $6)
      on conflict (campaign_id, subscriber_email) do update
      set
        status = excluded.status,
        provider_message_id = excluded.provider_message_id,
        error_message = excluded.error_message,
        created_at = now()
    `,
    [
      randomUUID(),
      input.campaignId,
      input.subscriberEmail.toLowerCase(),
      input.status,
      input.providerMessageId,
      input.errorMessage,
    ],
  );
}

export async function finalizeNewsletterCampaign(input: {
  campaignId: string;
  sentCount: number;
  failedCount: number;
}) {
  const pool = getPool();
  const result = await pool.query<CampaignRow>(
    `
      update newsletter_campaigns
      set
        status = $2,
        sent_count = $3,
        failed_count = $4,
        sent_at = now()
      where id = $1
      returning *
    `,
    [
      input.campaignId,
      input.failedCount > 0 ? "failed" : "sent",
      input.sentCount,
      input.failedCount,
    ],
  );

  return mapCampaign(result.rows[0]);
}
