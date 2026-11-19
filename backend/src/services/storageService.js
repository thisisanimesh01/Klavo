import fs from "fs";
import path from "path";
import { S3CompatibleStorageProvider, sanitizeS3Key } from "./s3StorageProvider.js";
import { metrics } from "../utils/metrics.js";

/**
 * Validates whether an SVG file buffer contains active scripts, javascript URIs, or malicious event handlers.
 * @param {Buffer} buffer
 * @returns {boolean} true if safe, false if contains suspicious script tags
 */
export const isSafeSvg = (buffer) => {
  const content = buffer.toString("utf8");
  // Check for dangerous XML/HTML script tags or active scripts
  const dangerousPatterns = [
    /<script\b[^>]*>([\s\S]*?)<\/script>/i,
    /<script\b/i,
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i,
    /onload\s*=/i,
    /onerror\s*=/i,
    /onclick\s*=/i,
    /onmouseover\s*=/i,
    /<foreignObject\b/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return false;
    }
  }
  return true;
};

/**
 * Local Disk Storage Provider Implementation.
 * Default provider for development and testing.
 */
export class LocalDiskStorageProvider {
  constructor(baseDir = "uploads") {
    this.baseDir = path.resolve(baseDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Sanitizes key to strictly prevent directory traversal attacks (e.g. ../../etc/passwd)
   */
  sanitizeKey(key) {
    const noPathSeparators = String(key).replace(/[\\/]/g, "");
    const noDots = noPathSeparators.replace(/\.+/g, ".");
    const safeBase = noDots.replace(/^\.+/, "");
    return safeBase.replace(/[^a-zA-Z0-9_.-]/g, "_");
  }

  getFilePath(storageKey) {
    const safeKey = this.sanitizeKey(storageKey);
    const resolvedPath = path.resolve(this.baseDir, safeKey);
    // Double verify path stays strictly inside baseDir
    if (!resolvedPath.startsWith(this.baseDir)) {
      throw new Error("Invalid storage path: directory traversal detected");
    }
    return resolvedPath;
  }

  async save(file, storageKey) {
    const targetPath = this.getFilePath(storageKey);
    // If multer already wrote to disk, ensure it's in targetPath
    if (file.path && file.path !== targetPath) {
      if (fs.existsSync(file.path)) {
        fs.renameSync(file.path, targetPath);
      }
    } else if (file.buffer) {
      fs.writeFileSync(targetPath, file.buffer);
    }
    return {
      storageKey: path.basename(targetPath),
      storageProvider: "local",
      size: file.size || (fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0),
    };
  }

  async getObject(storageKey) {
    const filePath = this.getFilePath(storageKey);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const buffer = fs.readFileSync(filePath);
    return {
      buffer,
      contentType: "application/octet-stream",
      contentLength: buffer.length,
    };
  }

  async delete(storageKey) {
    try {
      const filePath = this.getFilePath(storageKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (err) {
      console.warn("Local storage provider delete error:", err.message);
      return false;
    }
  }

  async exists(storageKey) {
    try {
      const filePath = this.getFilePath(storageKey);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

/**
 * Storage Service Factory
 * Configurable via STORAGE_PROVIDER environment variable:
 * - "local" (default): persists to local filesystem directory
 * - "s3": persists to AWS S3, Cloudflare R2, MinIO, or compatible object store
 */
export class StorageService {
  constructor(options = {}) {
    const providerType = options.provider || process.env.STORAGE_PROVIDER || "local";

    // Ensure temporary uploads directory exists for multipart staging
    const defaultUploadsDir = path.resolve(options.baseDir || process.env.UPLOADS_DIR || "uploads");
    if (!fs.existsSync(defaultUploadsDir)) {
      fs.mkdirSync(defaultUploadsDir, { recursive: true });
    }
    this.tempUploadsDir = defaultUploadsDir;

    if (providerType === "s3") {
      this.provider = new S3CompatibleStorageProvider({
        bucket: options.bucket || process.env.S3_BUCKET,
        region: options.region || process.env.S3_REGION || "us-east-1",
        endpoint: options.endpoint || process.env.S3_ENDPOINT,
        accessKeyId: options.accessKeyId || process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: options.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY,
        forcePathStyle: options.forcePathStyle !== undefined
          ? options.forcePathStyle
          : process.env.S3_FORCE_PATH_STYLE !== "false",
        fetchFn: options.fetchFn || globalThis.fetch,
      });
      // Expose baseDir getter on provider to maintain compatibility with multer setup
      this.provider.baseDir = defaultUploadsDir;
      this.type = "s3";
    } else {
      this.provider = new LocalDiskStorageProvider(defaultUploadsDir);
      this.type = "local";
    }
  }

  getFilePath(storageKey) {
    if (typeof this.provider.getFilePath === "function") {
      return this.provider.getFilePath(storageKey);
    }
    throw new Error("Local file path not applicable for cloud object storage provider");
  }

  async save(file, storageKey) {
    try {
      const result = await this.provider.save(file, storageKey);
      metrics.recordStorageOperation(false);
      return result;
    } catch (err) {
      metrics.recordStorageOperation(true);
      throw err;
    }
  }

  async getObject(storageKey) {
    try {
      const result = await this.provider.getObject(storageKey);
      metrics.recordStorageOperation(false);
      return result;
    } catch (err) {
      metrics.recordStorageOperation(true);
      throw err;
    }
  }

  async delete(storageKey) {
    try {
      const result = await this.provider.delete(storageKey);
      metrics.recordStorageOperation(false);
      return result;
    } catch (err) {
      metrics.recordStorageOperation(true);
      throw err;
    }
  }

  async exists(storageKey) {
    return this.provider.exists(storageKey);
  }

  getSignedUrl(storageKey, expiresInSeconds) {
    if (typeof this.provider.getSignedUrl === "function") {
      return this.provider.getSignedUrl(storageKey, expiresInSeconds);
    }
    return null;
  }
}

export const storageService = new StorageService();
export default storageService;
