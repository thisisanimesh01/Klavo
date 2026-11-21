import crypto from "crypto";

/**
 * Encrypts a string using AES-256-GCM.
 * Format: IV(12 bytes) + AUTH_TAG(16 bytes) + CIPHERTEXT
 * Output: hex string
 *
 * @param {string} text - Plaintext to encrypt
 * @param {string} secretKey - Secret key (e.g. JWT_SECRET or custom key)
 * @returns {string} Hex-encoded encrypted payload
 */
export const encryptSecret = (text, secretKey = process.env.JWT_SECRET) => {
  if (!text || typeof text !== "string") return "";
  if (!secretKey) throw new Error("Encryption key required");

  const key = crypto.createHash("sha256").update(secretKey).digest(); // 32 bytes
  const iv = crypto.randomBytes(12); // 96-bit IV
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("hex");
};

/**
 * Decrypts an AES-256-GCM encrypted hex string.
 *
 * @param {string} encryptedHex - Hex string produced by encryptSecret
 * @param {string} secretKey - Secret key (e.g. JWT_SECRET or custom key)
 * @returns {string} Decrypted plaintext
 */
export const decryptSecret = (encryptedHex, secretKey = process.env.JWT_SECRET) => {
  if (!encryptedHex || typeof encryptedHex !== "string") return "";
  if (!secretKey) throw new Error("Encryption key required");

  try {
    const buffer = Buffer.from(encryptedHex, "hex");
    if (buffer.length < 28) {
      throw new Error("Invalid encrypted payload length");
    }

    const key = crypto.createHash("sha256").update(secretKey).digest();
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    throw new Error(`Failed to decrypt secret: ${err.message}`);
  }
};

/**
 * Redacts sensitive credentials (tokens, passwords, keys) from an object or string for logging.
 *
 * @param {any} target - Object, array or string to sanitize
 * @returns {any} Sanitized target
 */
export const redactSensitiveData = (target) => {
  if (!target) return target;

  const SENSITIVE_KEYS = [
    "token",
    "secret",
    "password",
    "apiKey",
    "authorization",
    "credential",
    "clientSecret",
    "webhookSecret",
    "encryptedToken",
    "encryptedSecret",
    "accessToken",
  ];

  if (typeof target === "string") {
    // Redact Bearer tokens and URLs with tokens
    return target
      .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, "Bearer [REDACTED]")
      .replace(/(token|secret|password|key)=([a-zA-Z0-9_\-.]+)/gi, "$1=[REDACTED]");
  }

  if (Array.isArray(target)) {
    return target.map(redactSensitiveData);
  }

  if (typeof target === "object") {
    const clone = {};
    for (const [key, value] of Object.entries(target)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s.toLowerCase()))) {
        clone[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        clone[key] = redactSensitiveData(value);
      } else {
        clone[key] = value;
      }
    }
    return clone;
  }

  return target;
};

/**
 * Computes HMAC-SHA256 signature for webhooks.
 *
 * @param {string|Buffer} payload - Request body
 * @param {string} secret - Shared webhook secret
 * @returns {string} Hex signature prefixed with 'sha256='
 */
export const computeWebhookSignature = (payload, secret) => {
  const content = typeof payload === "string" ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret).update(content).digest("hex");
  return `sha256=${hmac}`;
};

/**
 * Verifies HMAC-SHA256 signature using timingSafeEqual to defeat timing attacks.
 *
 * @param {string|Buffer} payload - Raw request body
 * @param {string} signature - Header signature (e.g. 'sha256=...')
 * @param {string} secret - Shared secret
 * @returns {boolean} True if signature is valid
 */
export const verifyWebhookSignature = (payload, signature, secret) => {
  if (!payload || !signature || !secret) return false;

  const expected = computeWebhookSignature(payload, secret);
  try {
    const sigBuf = Buffer.from(signature.trim());
    const expBuf = Buffer.from(expected.trim());
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
};
