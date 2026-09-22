import crypto from "crypto";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
let cachedKey;
let keyResolved = false;

function decodeKey(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return null;

  if (/^[a-fA-F0-9]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    return null;
  }

  return null;
}

function resolveKey() {
  if (!keyResolved) {
    cachedKey = decodeKey(env.paymentTokenEncryptionKey);
    keyResolved = true;
  }
  return cachedKey || null;
}

export function isPaymentTokenStorageConfigured() {
  return Boolean(resolveKey());
}

function requireKey() {
  const key = resolveKey();
  if (!key) {
    throw new AppError(
      "Saved-card token encryption is not configured. Set PAYMENT_TOKEN_ENCRYPTION_KEY to a 32-byte base64 value or 64-character hex value.",
      503,
      "PAYMENT_TOKEN_ENCRYPTION_NOT_CONFIGURED",
    );
  }
  return key;
}

export function encryptPaymentToken(token) {
  const key = requireKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(token), "utf8"),
    cipher.final(),
  ]);

  return {
    tokenCiphertext: ciphertext.toString("base64"),
    tokenIv: iv.toString("base64"),
    tokenAuthTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptPaymentToken(paymentMethod) {
  const key = requireKey();
  const iv = Buffer.from(paymentMethod.tokenIv, "base64");
  const authTag = Buffer.from(paymentMethod.tokenAuthTag, "base64");
  const ciphertext = Buffer.from(paymentMethod.tokenCiphertext, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
