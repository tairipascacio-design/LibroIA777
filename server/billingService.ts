import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Request } from "express";

export type PlanTier = "free" | "pro";

export const FREE_LIMITS = {
  maxPersonalBooks: 1,
  maxChaptersPerBook: 2,
  maxFreeWordsPerBook: 1500,
  maxAiUses: 3,
  maxCharactersPerBook: 3,
  maxFreeAudiobookChapterIndex: 0, // Only Chapter 1 (index 0) sample for Free users
};

export interface BillingRecord {
  plan: PlanTier;
  aiUses: number;
  email?: string;
  provider?: "lemonsqueezy" | "stripe" | "demo";
  customerId?: string;
  subscriptionId?: string;
  portalUrl?: string;
  subscriptionStatus?: string;
  updatedAt: string;
}

export interface BillingStatusResponse {
  authenticated: boolean;
  userKey: string;
  email: string | null;
  plan: PlanTier;
  isPro: boolean;
  aiUses: number;
  aiLimit: number | null;
  aiRemaining: number | null;
  gatewayProvider: "stripe" | "lemonsqueezy" | "demo";
  billingConfigured: boolean;
  portalUrl: string | null;
  subscriptionStatus: string;
}

const STORE_DIR = path.resolve(process.cwd(), "data");
const STORE_PATH = path.resolve(STORE_DIR, "billing-store.json");

interface CachedToken {
  uid: string;
  email: string | null;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedToken>();

function getFirebaseApiKey(): string | null {
  try {
    const cfgPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(cfgPath)) return null;
    const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    return raw?.apiKey || null;
  } catch {
    return null;
  }
}

function readStore(): Record<string, BillingRecord> {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, BillingRecord>): void {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.error("Failed to write billing store:", err);
  }
}

function getConfiguredGateway(): "stripe" | "lemonsqueezy" | "demo" {
  if (
    process.env.STRIPE_SECRET_KEY &&
    (process.env.STRIPE_PRICE_MONTHLY || process.env.STRIPE_PRICE_ANNUAL)
  ) {
    return "stripe";
  }
  if (
    process.env.LEMONSQUEEZY_MONTHLY_URL ||
    process.env.LEMONSQUEEZY_ANNUAL_URL
  ) {
    return "lemonsqueezy";
  }
  return "demo";
}

export async function resolveRequesterIdentity(
  req: Request
): Promise<{ userKey: string; authenticated: boolean; email: string | null }> {
  const authHeader = String(req.headers.authorization || "");
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const idToken = match?.[1]?.trim();

  if (idToken && idToken.length > 20) {
    const cached = tokenCache.get(idToken);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        userKey: cached.uid,
        authenticated: true,
        email: cached.email,
      };
    }

    const apiKey = getFirebaseApiKey();
    if (apiKey) {
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
            apiKey
          )}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          }
        );
        if (res.ok) {
          const data: any = await res.json();
          const user = data?.users?.[0];
          if (user?.localId) {
            const entry: CachedToken = {
              uid: user.localId,
              email: user.email || null,
              expiresAt: Date.now() + 5 * 60 * 1000,
            };
            tokenCache.set(idToken, entry);
            return {
              userKey: entry.uid,
              authenticated: true,
              email: entry.email,
            };
          }
        }
      } catch (err) {
        console.warn("Firebase token verification warning:", err);
      }
    }
  }

  // Fallback anonymous session identifier (validated safe characters)
  const sessionHeader = String(req.headers["x-client-session-id"] || "").trim();
  const safeSession = sessionHeader.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (safeSession.length >= 6) {
    return {
      userKey: `anon_${safeSession}`,
      authenticated: false,
      email: null,
    };
  }

  return {
    userKey: "anon_default",
    authenticated: false,
    email: null,
  };
}

function getOrInitRecord(
  store: Record<string, BillingRecord>,
  userKey: string,
  email: string | null
): BillingRecord {
  const existing = store[userKey];
  if (existing) {
    if (email && !existing.email) {
      existing.email = email;
    }
    return existing;
  }
  const created: BillingRecord = {
    plan: "free",
    aiUses: 0,
    email: email || undefined,
    subscriptionStatus: "free",
    updatedAt: new Date().toISOString(),
  };
  store[userKey] = created;
  writeStore(store);
  return created;
}

export function buildStatusResponse(
  identity: { userKey: string; authenticated: boolean; email: string | null },
  record: BillingRecord
): BillingStatusResponse {
  const gateway = getConfiguredGateway();
  const isPro = record.plan === "pro";
  return {
    authenticated: identity.authenticated,
    userKey: identity.userKey,
    email: identity.email || record.email || null,
    plan: record.plan,
    isPro,
    aiUses: record.aiUses,
    aiLimit: isPro ? null : FREE_LIMITS.maxAiUses,
    aiRemaining: isPro
      ? null
      : Math.max(0, FREE_LIMITS.maxAiUses - record.aiUses),
    gatewayProvider: gateway,
    billingConfigured: gateway !== "demo",
    portalUrl:
      record.portalUrl ||
      process.env.LEMONSQUEEZY_PORTAL_URL ||
      null,
    subscriptionStatus: record.subscriptionStatus || (isPro ? "active" : "free"),
  };
}

export async function getBillingStatusForRequest(
  req: Request
): Promise<BillingStatusResponse> {
  const identity = await resolveRequesterIdentity(req);
  const store = readStore();
  const record = getOrInitRecord(store, identity.userKey, identity.email);
  return buildStatusResponse(identity, record);
}

export async function checkAndConsumeAiQuota(req: Request): Promise<{
  allowed: boolean;
  status: BillingStatusResponse;
}> {
  const identity = await resolveRequesterIdentity(req);
  const store = readStore();
  const record = getOrInitRecord(store, identity.userKey, identity.email);

  if (record.plan !== "pro" && record.aiUses >= FREE_LIMITS.maxAiUses) {
    return {
      allowed: false,
      status: buildStatusResponse(identity, record),
    };
  }

  record.aiUses += 1;
  record.updatedAt = new Date().toISOString();
  store[identity.userKey] = record;
  writeStore(store);

  return {
    allowed: true,
    status: buildStatusResponse(identity, record),
  };
}

export async function createCheckoutSessionForRequest(
  req: Request,
  cycle: "monthly" | "annual"
): Promise<{
  configured: boolean;
  provider: "stripe" | "lemonsqueezy" | "demo";
  url?: string;
  message?: string;
}> {
  const identity = await resolveRequesterIdentity(req);
  if (!identity.authenticated) {
    throw Object.assign(
      new Error("Inicia sesión con Google primero para asociar tu plan Pro a tu cuenta."),
      { statusCode: 401 }
    );
  }

  const origin =
    process.env.APP_URL ||
    (req.headers.origin as string) ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
  const gateway = getConfiguredGateway();

  if (gateway === "stripe") {
    const secretKey = process.env.STRIPE_SECRET_KEY!;
    const priceId =
      cycle === "annual"
        ? process.env.STRIPE_PRICE_ANNUAL || process.env.STRIPE_PRICE_MONTHLY!
        : process.env.STRIPE_PRICE_MONTHLY || process.env.STRIPE_PRICE_ANNUAL!;

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", `${origin}?checkout=success`);
    params.set("cancel_url", `${origin}?checkout=cancelled`);
    params.set("client_reference_id", identity.userKey);
    params.set("metadata[user_id]", identity.userKey);
    params.set("subscription_data[metadata][user_id]", identity.userKey);
    if (identity.email) {
      params.set("customer_email", identity.email);
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session: any = await stripeRes.json();
    if (!stripeRes.ok || !session?.url) {
      throw Object.assign(
        new Error(session?.error?.message || "No se pudo crear la sesión de pago en Stripe."),
        { statusCode: 502 }
      );
    }
    return { configured: true, provider: "stripe", url: session.url };
  }

  if (gateway === "lemonsqueezy") {
    const baseUrl =
      cycle === "annual"
        ? process.env.LEMONSQUEEZY_ANNUAL_URL || process.env.LEMONSQUEEZY_MONTHLY_URL!
        : process.env.LEMONSQUEEZY_MONTHLY_URL || process.env.LEMONSQUEEZY_ANNUAL_URL!;

    const target = new URL(baseUrl);
    target.searchParams.set("checkout[custom][user_id]", identity.userKey);
    if (identity.email) {
      target.searchParams.set("checkout[email]", identity.email);
    }
    target.searchParams.set("checkout[success_url]", `${origin}?checkout=success`);

    return { configured: true, provider: "lemonsqueezy", url: target.toString() };
  }

  return {
    configured: false,
    provider: "demo",
    message:
      "Configura LEMONSQUEEZY_MONTHLY_URL / STRIPE_SECRET_KEY en tus secretos para abrir el checkout real, o usa el modo de prueba Pro local.",
  };
}

export async function createPortalSessionForRequest(req: Request): Promise<{
  configured: boolean;
  url?: string;
  message?: string;
}> {
  const identity = await resolveRequesterIdentity(req);
  const store = readStore();
  const record = store[identity.userKey];
  const origin =
    process.env.APP_URL ||
    (req.headers.origin as string) ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

  if (process.env.STRIPE_SECRET_KEY && record?.customerId) {
    const params = new URLSearchParams();
    params.set("customer", record.customerId);
    params.set("return_url", origin);

    const portalRes = await fetch(
      "https://api.stripe.com/v1/billing_portal/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    const data: any = await portalRes.json();
    if (portalRes.ok && data?.url) {
      return { configured: true, url: data.url };
    }
  }

  const lemonPortal =
    record?.portalUrl || process.env.LEMONSQUEEZY_PORTAL_URL;
  if (lemonPortal) {
    return { configured: true, url: lemonPortal };
  }

  return {
    configured: false,
    message:
      "El portal automático de facturas se activará en cuanto conectes Lemon Squeezy o Stripe en tus variables de entorno.",
  };
}

export async function toggleDemoPlanForRequest(
  req: Request,
  plan: PlanTier
): Promise<BillingStatusResponse> {
  if (getConfiguredGateway() !== "demo") {
    throw Object.assign(
      new Error(
        "El modo de prueba local está deshabilitado porque existe una pasarela de pago real configurada."
      ),
      { statusCode: 403 }
    );
  }
  const identity = await resolveRequesterIdentity(req);
  const store = readStore();
  const record = getOrInitRecord(store, identity.userKey, identity.email);
  record.plan = plan;
  record.provider = "demo";
  record.subscriptionStatus = plan === "pro" ? "demo_active" : "free";
  record.updatedAt = new Date().toISOString();
  store[identity.userKey] = record;
  writeStore(store);
  return buildStatusResponse(identity, record);
}

function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyStripeSignature(
  rawBody: string,
  sigHeader: string,
  secret: string
): boolean {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  if (!parts.t || !parts.v1) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.t}.${rawBody}`, "utf8")
    .digest("hex");
  return timingSafeHexEqual(expected, parts.v1);
}

export function processVerifiedWebhook(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>
): { ok: boolean; userKey?: string; plan?: PlanTier } {
  const lemonSig = String(headers["x-signature"] || "");
  const stripeSig = String(headers["stripe-signature"] || "");

  // 1. Lemon Squeezy HMAC Webhook
  if (lemonSig) {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
      throw Object.assign(new Error("LEMONSQUEEZY_WEBHOOK_SECRET no configurado"), {
        statusCode: 500,
      });
    }
    const digest = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");
    if (!timingSafeHexEqual(digest, lemonSig)) {
      throw Object.assign(new Error("Firma HMAC de Lemon Squeezy inválida"), {
        statusCode: 401,
      });
    }

    const payload = JSON.parse(rawBody);
    const eventName: string = payload?.meta?.event_name || "";
    const userId: string | undefined = payload?.meta?.custom_data?.user_id;
    const attrs = payload?.data?.attributes || {};
    const portalUrl: string | undefined =
      attrs?.urls?.customer_portal || undefined;

    if (!userId) {
      return { ok: true };
    }

    const store = readStore();
    const record = getOrInitRecord(store, userId, attrs?.user_email || null);
    const shouldActivate =
      eventName === "order_created" ||
      eventName === "subscription_created" ||
      eventName === "subscription_updated" ||
      eventName === "subscription_resumed" ||
      eventName === "subscription_payment_success";
    const shouldDowngrade =
      eventName === "subscription_expired" ||
      eventName === "subscription_cancelled" ||
      attrs?.status === "expired";

    if (shouldDowngrade) {
      record.plan = "free";
      record.subscriptionStatus = attrs?.status || "cancelled";
    } else if (shouldActivate) {
      record.plan = "pro";
      record.subscriptionStatus = attrs?.status || "active";
    }
    record.provider = "lemonsqueezy";
    record.customerId = String(attrs?.customer_id || record.customerId || "");
    record.subscriptionId = String(payload?.data?.id || record.subscriptionId || "");
    if (portalUrl) record.portalUrl = portalUrl;
    record.updatedAt = new Date().toISOString();
    store[userId] = record;
    writeStore(store);

    return { ok: true, userKey: userId, plan: record.plan };
  }

  // 2. Stripe HMAC Webhook
  if (stripeSig) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw Object.assign(new Error("STRIPE_WEBHOOK_SECRET no configurado"), {
        statusCode: 500,
      });
    }
    if (!verifyStripeSignature(rawBody, stripeSig, secret)) {
      throw Object.assign(new Error("Firma Stripe-Signature inválida"), {
        statusCode: 401,
      });
    }

    const event = JSON.parse(rawBody);
    const obj = event?.data?.object || {};
    const userId: string | undefined =
      obj?.metadata?.user_id || obj?.client_reference_id;
    const customerId: string | undefined =
      typeof obj?.customer === "string" ? obj.customer : undefined;

    const store = readStore();
    let targetKey = userId;
    if (!targetKey && customerId) {
      targetKey = Object.keys(store).find(
        (k) => store[k]?.customerId === customerId
      );
    }

    if (!targetKey) {
      return { ok: true };
    }

    const record = getOrInitRecord(store, targetKey, obj?.customer_email || null);
    if (
      event.type === "checkout.session.completed" ||
      event.type === "invoice.paid" ||
      (event.type === "customer.subscription.updated" &&
        (obj.status === "active" || obj.status === "trialing"))
    ) {
      record.plan = "pro";
      record.subscriptionStatus = obj.status || "active";
    } else if (
      event.type === "customer.subscription.deleted" ||
      (event.type === "customer.subscription.updated" &&
        (obj.status === "canceled" || obj.status === "unpaid"))
    ) {
      record.plan = "free";
      record.subscriptionStatus = obj.status || "canceled";
    }

    record.provider = "stripe";
    if (customerId) record.customerId = customerId;
    if (obj?.subscription && typeof obj.subscription === "string") {
      record.subscriptionId = obj.subscription;
    }
    record.updatedAt = new Date().toISOString();
    store[targetKey] = record;
    writeStore(store);

    return { ok: true, userKey: targetKey, plan: record.plan };
  }

  throw Object.assign(new Error("Encabezado de firma de webhook faltante"), {
    statusCode: 401,
  });
}
