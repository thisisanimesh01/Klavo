import crypto from "crypto";
import DocumentVersion from "../models/DocumentVersion.js";
import { sanitizeDocumentHtml, sanitizeDocumentJson } from "./documentSanitizer.js";

/**
 * Computes a SHA-256 hash of document content to detect meaningful changes
 * and prevent duplicate snapshots.
 *
 * @param {string} title
 * @param {object|string} content
 * @param {string} [contentHtml=""]
 * @returns {string} Hex hash string
 */
export const computeContentHash = (title, content, contentHtml = "") => {
  const normalized = JSON.stringify({
    title: (title || "").trim(),
    content: content || null,
    contentHtml: (contentHtml || "").trim(),
  });
  return crypto.createHash("sha256").update(normalized).digest("hex");
};

/**
 * Creates a new document version snapshot if content has meaningfully changed
 * or if it is an explicit named snapshot / restoration.
 *
 * Handles atomic sequential revision numbers and duplicate-hash deduplication.
 *
 * @param {object} params
 * @param {string|ObjectId} params.documentId
 * @param {string|ObjectId} params.projectId
 * @param {string} params.title
 * @param {object} params.content
 * @param {string} params.contentHtml
 * @param {string} [params.description=""]
 * @param {string} [params.yjsUpdate=null]
 * @param {string|ObjectId} params.authorId
 * @param {boolean} [params.isNamedSnapshot=false]
 * @param {string} [params.snapshotName=null]
 * @param {string} [params.changeSummary="Updated document"]
 * @param {boolean} [params.force=false] - If true, bypass duplicate hash check
 * @returns {Promise<object|null>} The created DocumentVersion or null if skipped as duplicate
 */
export const createDocumentVersionSnapshot = async ({
  documentId,
  projectId,
  title,
  content,
  contentHtml,
  description = "",
  yjsUpdate = null,
  authorId,
  isNamedSnapshot = false,
  snapshotName = null,
  changeSummary = "Updated document",
  force = false,
}) => {
  const safeTitle = (title || "").trim() || "Untitled Document";
  const safeContent = sanitizeDocumentJson(content);
  const safeHtml = sanitizeDocumentHtml(contentHtml || "<p></p>");
  const currentHash = computeContentHash(safeTitle, safeContent, safeHtml);

  // Retry loop for atomic concurrent version number assignment
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Find current latest revision
      const latestVersion = await DocumentVersion.findOne({ documentId })
        .sort({ revisionNumber: -1 });

      // Deduplication check: if content hash matches latest version and not forced, skip
      if (!force && latestVersion && latestVersion.contentHash === currentHash) {
        return null;
      }

      const nextRevisionNumber = latestVersion ? latestVersion.revisionNumber + 1 : 1;

      const version = await DocumentVersion.create({
        documentId,
        projectId,
        revisionNumber: nextRevisionNumber,
        title: safeTitle,
        content: safeContent,
        contentHtml: safeHtml,
        description: description || "",
        yjsUpdate: yjsUpdate || null,
        authorId,
        isNamedSnapshot: Boolean(isNamedSnapshot),
        snapshotName: snapshotName ? snapshotName.trim() : null,
        changeSummary: (changeSummary && changeSummary.trim()) || "Snapshot",
        contentHash: currentHash,
      });

      return version;
    } catch (err) {
      // If unique index { documentId: 1, revisionNumber: -1 } conflicts due to race condition, retry
      if (err.code === 11000 && attempt < 2) {
        continue;
      }
      console.error("Failed to create document version snapshot:", err);
      return null;
    }
  }

  return null;
};

/**
 * Computes a sanitized visual diff between two HTML strings.
 * Returns word/token level changes: array of { type: 'unchanged' | 'added' | 'removed', value: string }
 *
 * @param {string} oldText
 * @param {string} newText
 * @returns {Array<{type: 'unchanged'|'added'|'removed', value: string}>}
 */
export const computeTextDiff = (oldText = "", newText = "") => {
  const sanitizedOld = sanitizeDocumentHtml(oldText || "");
  const sanitizedNew = sanitizeDocumentHtml(newText || "");

  const cleanOld = sanitizedOld.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const cleanNew = sanitizedNew.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const oldTokens = cleanOld ? cleanOld.split(/\s+/) : [];
  const newTokens = cleanNew ? cleanNew.split(/\s+/) : [];

  const diff = [];
  let i = 0;
  let j = 0;

  while (i < oldTokens.length || j < newTokens.length) {
    if (i < oldTokens.length && j < newTokens.length && oldTokens[i] === newTokens[j]) {
      diff.push({ type: "unchanged", value: oldTokens[i] });
      i++;
      j++;
    } else if (j < newTokens.length && (!oldTokens.includes(newTokens[j]) || i >= oldTokens.length)) {
      diff.push({ type: "added", value: newTokens[j] });
      j++;
    } else if (i < oldTokens.length) {
      diff.push({ type: "removed", value: oldTokens[i] });
      i++;
    } else {
      break;
    }
  }

  return diff;
};
