import fs from "fs";
import path from "path";

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
 * Storage provider interface.
 */
class LocalDiskStorageProvider {
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
    // Strip all path separators (both POSIX / and Windows \)
    const noPathSeparators = String(key).replace(/[\\/]/g, "");
    // Remove all consecutive dots to prevent traversal
    const noDots = noPathSeparators.replace(/\.+/g, ".");
    const safeBase = noDots.replace(/^\.+/, ""); // remove leading dots
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
    }
    return {
      storageKey: path.basename(targetPath),
      storageProvider: "local",
      size: file.size,
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
 * Supports "local" by default and enables plugging in an S3/GCS/R2 provider
 * without vendor lock-in or extra paid service requirements.
 */
class StorageService {
  constructor() {
    this.provider = new LocalDiskStorageProvider();
  }

  getFilePath(storageKey) {
    return this.provider.getFilePath(storageKey);
  }

  async save(file, storageKey) {
    return this.provider.save(file, storageKey);
  }

  async delete(storageKey) {
    return this.provider.delete(storageKey);
  }

  async exists(storageKey) {
    return this.provider.exists(storageKey);
  }
}

export const storageService = new StorageService();
export default storageService;
