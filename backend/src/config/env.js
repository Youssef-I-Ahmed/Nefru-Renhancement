import dotenv from "dotenv";

dotenv.config();
const nodeEnv = process.env.NODE_ENV || "development";
const jwtSecret = process.env.JWT_SECRET || "";
const frontendUrl = (process.env.FRONTEND_URL || (nodeEnv === "production" ? "" : "http://localhost:5173")).replace(/\/+$/, "");
const backendPublicUrl = (process.env.BACKEND_PUBLIC_URL || (nodeEnv === "production" ? "" : "http://localhost:5000")).replace(/\/+$/, "");
const requestedSameSite = String(
  process.env.COOKIE_SAME_SITE || (nodeEnv === "production" ? "none" : "lax"),
).toLowerCase();
const cookieSameSite = ["lax", "strict", "none"].includes(requestedSameSite)
  ? requestedSameSite
  : "lax";
const devAuthBypass =
  nodeEnv === "development" &&
  String(process.env.DEV_AUTH_BYPASS || "false").toLowerCase() !== "false";

const paymobIntegrationIds = String(process.env.PAYMOB_INTEGRATION_IDS || "")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter(Number.isInteger);

if (nodeEnv === "production" && !jwtSecret) {
  throw new Error("JWT_SECRET must be configured in production");
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || (nodeEnv === "production" ? "" : "mongodb://127.0.0.1:27017/nefru"),

  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  frontendUrl,
  backendPublicUrl,
  cookieSameSite,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  devAuthBypass,

  cloudinaryUrl: process.env.CLOUDINARY_URL,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || "nefru",

  paymobBaseUrl: (process.env.PAYMOB_BASE_URL || "https://accept.paymob.com").replace(/\/+$/, ""),
  paymobSecretKey: process.env.PAYMOB_SECRET_KEY,
  paymobPublicKey: process.env.PAYMOB_PUBLIC_KEY,
  paymobHmacSecret: process.env.PAYMOB_HMAC_SECRET,
  paymobApiKey: process.env.PAYMOB_API_KEY,
  paymobIntegrationIds,
  paymobCurrency: String(process.env.PAYMOB_CURRENCY || "EGP").toUpperCase(),

  paymobCheckoutExpirationSeconds: Math.max(
    60,
    Math.min(Number(process.env.PAYMOB_CHECKOUT_EXPIRATION_SECONDS) || 900, 3600),
  ),

  paymobWebhookUrl: (process.env.PAYMOB_WEBHOOK_URL || "https://doorbell-bottling-astride.ngrok-free.dev/api/payments/paymob/webhook").trim(),

  paymobCheckoutMode: ["pixel", "redirect"].includes(
    String(process.env.PAYMOB_CHECKOUT_MODE || "pixel").trim().toLowerCase(),
  )
    ? String(process.env.PAYMOB_CHECKOUT_MODE || "pixel").trim().toLowerCase()
    : "pixel",
  paymentTokenEncryptionKey: process.env.PAYMENT_TOKEN_ENCRYPTION_KEY?.trim(),

  // Tourist display FX. EGP remains the only booking/payment source of truth.
  fxProviderUrl: (process.env.FX_PROVIDER_URL || "https://api.frankfurter.dev/v2/rates").trim(),
  fxProvider: String(process.env.FX_PROVIDER || "cbe").trim().toLowerCase(),
  fxRefreshHours: Math.max(1, Number(process.env.FX_REFRESH_HOURS) || 12),
  fxRefreshMs: Math.max(1, Number(process.env.FX_REFRESH_HOURS) || 12) * 60 * 60 * 1000,
  fxRequestTimeoutMs: Math.max(1000, Number(process.env.FX_REQUEST_TIMEOUT_MS) || 10000),


  resendApiKey: process.env.RESEND_API_KEY?.trim(),
  mailerFrom:
    process.env.MAILER_FROM?.trim() ||
    "Nefru <onboarding@resend.dev>",
  mailerHost: process.env.MAILER_HOST || "smtp.gmail.com",
  mailerPort: Number(process.env.MAILER_PORT) || 465,
  mailerEmail: process.env.MAILER_EMAIL || "nefru.team@gmail.com",
  mailerPassword: process.env.MAILER_PASSWORD,

  emailAdmin: process.env.EMAIL_ADMIN || "superadmin@nefru.com",
  passwordAdmin: process.env.PASSWORD_ADMIN,
  emailTourist: process.env.EMAIL_TOURIST || "tourist@test.com",
  passwordTourist: process.env.PASSWORD_TOURIST,
  emailGuide: process.env.EMAIL_GUIDE || "guide@test.com",
  passwordGuide: process.env.PASSWORD_GUIDE,
  reviewInviteDelayMinutes: Math.max(
  1,
  Number(process.env.REVIEW_INVITE_DELAY_MINUTES) || 45,
),
};



if (nodeEnv === "production") {
  for (const key of ["MONGODB_URI", "FRONTEND_URL", "BACKEND_PUBLIC_URL"]) {
    if (!process.env[key]?.trim()) throw new Error(`${key} must be configured in production`);
  }
  for (const value of [frontendUrl, backendPublicUrl]) {
    let url;
    try { url = new URL(value); } catch { throw new Error("Production frontend/backend URLs must be valid HTTPS URLs"); }
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("Production frontend/backend URLs must use HTTPS without credentials");
    }
  }
}


export function getPaymobWebhookUrl() {
  if (env.paymobWebhookUrl) return env.paymobWebhookUrl;
  if (!env.backendPublicUrl) return "";
  return `${env.backendPublicUrl}/api/payments/paymob/webhook`;
}

