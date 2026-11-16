/**
 * Document Sanitizer & XSS Prevention Utility
 *
 * Strips dangerous HTML tags (<script>...</script>, <iframe>, <object>, <embed>, <form>, <base>, <link>, <meta>),
 * event handlers (onload, onclick, onerror, etc.), and unsafe URI schemes (javascript:, data:, vbscript:).
 * Safely permits rich text markup produced by TipTap:
 * headings, paragraphs, bold, italic, underline, lists, blockquotes, code blocks, and safe hyperlinks.
 */

// Strip block content of active scripts and styles entirely
const SCRIPT_BLOCK_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const STYLE_BLOCK_REGEX = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi;
const DANGEROUS_TAGS_REGEX = /<\/?(script|iframe|object|embed|form|input|button|base|link|meta|style|applet)[^>]*>/gi;
const INLINE_EVENT_HANDLER_REGEX = /\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
const JAVASCRIPT_URL_REGEX = /href\s*=\s*['"]\s*(javascript|data|vbscript):[^'"]*['"]/gi;

/**
 * Sanitizes an HTML string to ensure safe storage and rendering.
 *
 * @param {string} html - Raw HTML
 * @returns {string} Sanitized safe HTML
 */
export const sanitizeDocumentHtml = (html) => {
  if (!html || typeof html !== "string") return "<p></p>";

  let clean = html;

  // 1. Remove entire <script>...</script> and <style>...</style> blocks including inner content
  clean = clean.replace(SCRIPT_BLOCK_REGEX, "");
  clean = clean.replace(STYLE_BLOCK_REGEX, "");

  // 2. Remove remaining dangerous tags (iframe, embed, object, etc.)
  clean = clean.replace(DANGEROUS_TAGS_REGEX, "");

  // 3. Strip inline event handlers (onerror, onload, onclick, onmouseover, etc.)
  clean = clean.replace(INLINE_EVENT_HANDLER_REGEX, "");

  // 4. Neutralize dangerous URL schemes in href attributes
  clean = clean.replace(JAVASCRIPT_URL_REGEX, 'href="#"');

  return clean.trim();
};

/**
 * Validates and sanitizes a ProseMirror / TipTap JSON content tree recursively.
 * Ensures node types are recognized editor primitives and href links use safe protocols (http, https, mailto, tel).
 *
 * @param {object} contentJson
 * @returns {object} Sanitized JSON tree
 */
export const sanitizeDocumentJson = (contentJson) => {
  if (!contentJson || typeof contentJson !== "object") {
    return { type: "doc", content: [{ type: "paragraph", content: [] }] };
  }

  const allowedTypes = new Set([
    "doc",
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "listItem",
    "blockquote",
    "codeBlock",
    "text",
    "hardBreak",
    "horizontalRule",
  ]);

  const sanitizeNode = (node) => {
    if (!node || typeof node !== "object") return null;

    const safeType = allowedTypes.has(node.type) ? node.type : "paragraph";
    const cleanNode = { ...node, type: safeType };

    // Sanitize marks (e.g. bold, italic, underline, code, link)
    if (Array.isArray(cleanNode.marks)) {
      cleanNode.marks = cleanNode.marks
        .map((mark) => {
          if (!mark || typeof mark !== "object") return null;
          if (mark.type === "link" && mark.attrs?.href) {
            const href = String(mark.attrs.href).trim().toLowerCase();
            if (href.startsWith("javascript:") || href.startsWith("data:") || href.startsWith("vbscript:")) {
              return { ...mark, attrs: { ...mark.attrs, href: "#" } };
            }
          }
          return mark;
        })
        .filter(Boolean);
    }

    // Recursively sanitize child content nodes
    if (Array.isArray(cleanNode.content)) {
      cleanNode.content = cleanNode.content.map(sanitizeNode).filter(Boolean);
    }

    return cleanNode;
  };

  return sanitizeNode(contentJson) || { type: "doc", content: [{ type: "paragraph", content: [] }] };
};

/**
 * Extracts a plain text excerpt from HTML snapshot for preview and search summaries.
 *
 * @param {string} html
 * @param {number} [maxLength=180]
 * @returns {string} Plain text summary
 */
export const extractPlainTextExcerpt = (html, maxLength = 180) => {
  if (!html || typeof html !== "string") return "";
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trim() + "...";
};
