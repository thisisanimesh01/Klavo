import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Validates and sanitizes S3 object keys to prevent directory traversal
 * and ensure uniform key namespace isolation.
 *
 * @param {string} key
 * @returns {string} Sanitized object key
 */
export const sanitizeS3Key = (key) => {
  if (!key) return "";
  // Strip null bytes and non-printable characters
  const clean = String(key).replace(/[\0\r\n]/g, "");
  // Normalize forward and back slashes
  const normalized = clean.replace(/\\/g, "/");
  // Prevent path traversal sequences (/../, /./, ../, etc.)
  const segments = normalized.split("/").filter((seg) => seg && seg !== "." && seg !== "..");
  // Sanitize individual segments: allow alphanumeric, hyphens, underscores, dots, @
  const sanitizedSegments = segments.map((seg) =>
    seg.replace(/[^a-zA-Z0-9_.-]/g, "_")
  );
  return sanitizedSegments.join("/");
};

/**
 * Production-ready S3-Compatible Object Storage Provider.
 * Suitable for AWS S3, Cloudflare R2, MinIO, or Google Cloud Storage (S3-interop).
 *
 * Implemented using Node's standard Fetch API and HMAC-SHA256 (AWS Signature Version 4)
 * with zero external npm dependencies.
 */
export class S3CompatibleStorageProvider {
  /**
   * @param {object} config
   * @param {string} config.bucket - Target S3 bucket name
   * @param {string} [config.region='us-east-1'] - AWS / S3 region
   * @param {string} [config.endpoint] - Optional custom endpoint (e.g. MinIO http://127.0.0.1:9000 or R2 https://<account>.r2.cloudflarestorage.com)
   * @param {string} config.accessKeyId - S3 Access Key ID
   * @param {string} config.secretAccessKey - S3 Secret Access Key
   * @param {boolean} [config.forcePathStyle=true] - Force path-style bucket URLs (recommended for MinIO & local dev)
   * @param {Function} [config.fetchFn=globalThis.fetch] - Injectable fetch for unit tests and offline mocking
   */
  constructor(config = {}) {
    const {
      bucket,
      region = "us-east-1",
      endpoint,
      accessKeyId,
      secretAccessKey,
      forcePathStyle = true,
      fetchFn = globalThis.fetch,
    } = config;

    if (!bucket) {
      throw new Error("S3StorageProvider requires 'bucket' configuration");
    }
    if (!accessKeyId) {
      throw new Error("S3StorageProvider requires 'accessKeyId' configuration");
    }
    if (!secretAccessKey) {
      throw new Error("S3StorageProvider requires 'secretAccessKey' configuration");
    }

    this.bucket = bucket;
    this.region = region;
    this.endpoint = endpoint ? endpoint.replace(/\/+$/, "") : null;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.forcePathStyle = forcePathStyle;
    this.fetch = fetchFn;
  }

  sanitizeKey(key) {
    return sanitizeS3Key(key);
  }

  /**
   * Builds the full HTTP/HTTPS URL for a given object key.
   */
  getObjectUrl(storageKey) {
    const safeKey = this.sanitizeKey(storageKey);
    if (this.endpoint) {
      if (this.forcePathStyle) {
        return `${this.endpoint}/${this.bucket}/${safeKey}`;
      }
      return `${this.endpoint}/${safeKey}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${safeKey}`;
  }

  /**
   * Signs an AWS SigV4 request header map.
   */
  signHeaders({ method, url, headers = {}, bodySha256 = "UNSIGNED-PAYLOAD" }) {
    const parsedUrl = new URL(url);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    const host = parsedUrl.host;
    const requestHeaders = {
      ...headers,
      host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": bodySha256,
    };

    // Canonical headers
    const sortedHeaderKeys = Object.keys(requestHeaders)
      .map((k) => k.toLowerCase())
      .sort();
    const canonicalHeadersStr = sortedHeaderKeys
      .map((k) => `${k}:${requestHeaders[k].trim()}\n`)
      .join("");
    const signedHeadersStr = sortedHeaderKeys.join(";");

    // Canonical Request
    const canonicalUri = parsedUrl.pathname;
    const canonicalQuery = parsedUrl.search ? parsedUrl.search.slice(1) : "";
    const canonicalRequest = [
      method.toUpperCase(),
      canonicalUri,
      canonicalQuery,
      canonicalHeadersStr,
      signedHeadersStr,
      bodySha256,
    ].join("\n");

    // String to Sign
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
    ].join("\n");

    // Signing Key
    const kDate = crypto.createHmac("sha256", `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac("sha256", kDate).update(this.region).digest();
    const kService = crypto.createHmac("sha256", kRegion).update("s3").digest();
    const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();

    const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

    const authorization = `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

    return {
      ...requestHeaders,
      Authorization: authorization,
    };
  }

  /**
   * Generates a pre-signed S3 URL for temporary direct access.
   *
   * @param {string} storageKey
   * @param {number} [expiresInSeconds=900] - 15 minutes default
   * @returns {string} Presigned URL
   */
  getSignedUrl(storageKey, expiresInSeconds = 900) {
    const safeKey = this.sanitizeKey(storageKey);
    const objectUrl = this.getObjectUrl(safeKey);
    const parsedUrl = new URL(objectUrl);

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    parsedUrl.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
    parsedUrl.searchParams.set("X-Amz-Credential", `${this.accessKeyId}/${credentialScope}`);
    parsedUrl.searchParams.set("X-Amz-Date", amzDate);
    parsedUrl.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    parsedUrl.searchParams.set("X-Amz-SignedHeaders", "host");

    // Sort query params alphabetically
    const sortedParams = Array.from(parsedUrl.searchParams.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const canonicalQuery = sortedParams
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const canonicalHeaders = `host:${parsedUrl.host}\n`;
    const signedHeaders = "host";
    const payloadHash = "UNSIGNED-PAYLOAD";

    const canonicalRequest = [
      "GET",
      parsedUrl.pathname,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
    ].join("\n");

    const kDate = crypto.createHmac("sha256", `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac("sha256", kDate).update(this.region).digest();
    const kService = crypto.createHmac("sha256", kRegion).update("s3").digest();
    const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();

    const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
    parsedUrl.searchParams.set("X-Amz-Signature", signature);

    return parsedUrl.toString();
  }

  /**
   * Uploads/persists a file to S3.
   *
   * @param {object} file - Express/Multer file object or Buffer
   * @param {string} storageKey
   * @returns {Promise<object>}
   */
  async save(file, storageKey) {
    const safeKey = this.sanitizeKey(storageKey);
    const url = this.getObjectUrl(safeKey);

    let buffer;
    let size = file.size;

    if (Buffer.isBuffer(file)) {
      buffer = file;
      size = buffer.length;
    } else if (file.buffer) {
      buffer = file.buffer;
      size = size !== undefined ? size : buffer.length;
    } else if (file.path && fs.existsSync(file.path)) {
      buffer = fs.readFileSync(file.path);
      size = size !== undefined ? size : buffer.length;
    } else {
      throw new Error("Invalid file payload: must contain buffer or existing file path");
    }

    const bodySha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const contentType = file.mimetype || "application/octet-stream";

    const headers = this.signHeaders({
      method: "PUT",
      url,
      headers: {
        "content-type": contentType,
        "content-length": String(buffer.length),
      },
      bodySha256,
    });

    const response = await this.fetch(url, {
      method: "PUT",
      headers,
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`S3 PutObject failed [${response.status}]: ${errorText}`);
    }

    // Clean up temporary local upload file if present
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        // Non-fatal temporary file cleanup
      }
    }

    return {
      storageKey: safeKey,
      storageProvider: "s3",
      size,
    };
  }

  /**
   * Retrieves an object stream / buffer from S3.
   *
   * @param {string} storageKey
   * @returns {Promise<object>} ReadableStream / buffer with headers
   */
  async getObject(storageKey) {
    const safeKey = this.sanitizeKey(storageKey);
    const url = this.getObjectUrl(safeKey);

    const headers = this.signHeaders({
      method: "GET",
      url,
      headers: {},
      bodySha256: "UNSIGNED-PAYLOAD",
    });

    const response = await this.fetch(url, {
      method: "GET",
      headers,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`S3 GetObject failed [${response.status}]: ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      buffer,
      contentType: response.headers.get("content-type") || "application/octet-stream",
      contentLength: Number(response.headers.get("content-length")) || buffer.length,
      etag: response.headers.get("etag") || null,
    };
  }

  /**
   * Deletes an object from S3.
   */
  async delete(storageKey) {
    const safeKey = this.sanitizeKey(storageKey);
    const url = this.getObjectUrl(safeKey);

    const headers = this.signHeaders({
      method: "DELETE",
      url,
      headers: {},
      bodySha256: "UNSIGNED-PAYLOAD",
    });

    try {
      const response = await this.fetch(url, {
        method: "DELETE",
        headers,
      });
      // S3 DELETE returns 204 No Content on success
      return response.ok || response.status === 404;
    } catch (err) {
      console.warn("S3 DeleteObject error:", err.message);
      return false;
    }
  }

  /**
   * Checks if an object exists in S3 (via HEAD request).
   */
  async exists(storageKey) {
    const safeKey = this.sanitizeKey(storageKey);
    const url = this.getObjectUrl(safeKey);

    const headers = this.signHeaders({
      method: "HEAD",
      url,
      headers: {},
      bodySha256: "UNSIGNED-PAYLOAD",
    });

    try {
      const response = await this.fetch(url, {
        method: "HEAD",
        headers,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
