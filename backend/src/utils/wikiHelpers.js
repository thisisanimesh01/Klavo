import Document from "../models/Document.js";

/**
 * Validates that setting `targetParentWikiId` as parent of `wikiDocId` does not create a circular dependency.
 * Traversing upward from `targetParentWikiId` must never encounter `wikiDocId`.
 *
 * @param {string|ObjectId} wikiDocId - The wiki page being moved/nested
 * @param {string|ObjectId|null} targetParentWikiId - The intended new parent wiki page
 * @returns {Promise<{isCircular: boolean, path: string[]}>}
 */
export const checkCircularWikiNesting = async (wikiDocId, targetParentWikiId) => {
  if (!targetParentWikiId) {
    return { isCircular: false, path: [] };
  }

  const wikiDocIdStr = wikiDocId.toString();
  const targetParentWikiIdStr = targetParentWikiId.toString();

  // Self-nesting check
  if (wikiDocIdStr === targetParentWikiIdStr) {
    return { isCircular: true, path: [wikiDocIdStr, targetParentWikiIdStr] };
  }

  const visited = [targetParentWikiIdStr];
  let currId = targetParentWikiId;

  // Traverse ancestors upward to root
  while (currId) {
    const parentDoc = await Document.findById(currId).select("parentWikiId title isWiki");
    if (!parentDoc) break;

    const ancestorIdStr = parentDoc.parentWikiId ? parentDoc.parentWikiId.toString() : null;

    if (ancestorIdStr === wikiDocIdStr) {
      visited.push(wikiDocIdStr);
      return { isCircular: true, path: visited };
    }

    if (ancestorIdStr) {
      // Loop guard against corrupted cycles
      if (visited.includes(ancestorIdStr)) {
        return { isCircular: true, path: visited };
      }
      visited.push(ancestorIdStr);
    }

    currId = parentDoc.parentWikiId;
  }

  return { isCircular: false, path: visited };
};

/**
 * Recursively resolves the full ancestry path (breadcrumbs) for a wiki document.
 * Returns array from root wiki page down to target page: [{ _id, title, isWikiHome, wikiSlug }]
 *
 * @param {string|ObjectId|null} wikiDocId
 * @returns {Promise<Array<{_id: string, title: string, isWikiHome: boolean, wikiSlug: string}>>}
 */
export const getWikiBreadcrumbs = async (wikiDocId) => {
  if (!wikiDocId) return [];

  const trail = [];
  const visited = new Set();
  let currId = wikiDocId;

  while (currId && !visited.has(currId.toString())) {
    visited.add(currId.toString());
    const doc = await Document.findById(currId).select("title parentWikiId isWiki isWikiHome wikiSlug");
    if (!doc) break;

    trail.unshift({
      _id: doc._id,
      title: doc.title,
      isWikiHome: Boolean(doc.isWikiHome),
      wikiSlug: doc.wikiSlug,
      parentWikiId: doc.parentWikiId,
    });

    currId = doc.parentWikiId;
  }

  return trail;
};

/**
 * Builds a hierarchical tree from a flat list of wiki documents.
 * Preserves ordering by `wikiOrder` ascending, then `createdAt` ascending.
 *
 * @param {Array<object>} wikiPages
 * @param {string|null} rootParentId
 * @returns {Array<object>} Tree structure with nested `children` arrays
 */
export const buildWikiTree = (wikiPages, rootParentId = null) => {
  const rootIdStr = rootParentId ? rootParentId.toString() : null;
  const map = new Map();

  // Clone objects and initialize children
  wikiPages.forEach((p) => {
    const docObj = typeof p.toObject === "function" ? p.toObject() : { ...p };
    docObj.children = [];
    map.set(docObj._id.toString(), docObj);
  });

  const roots = [];

  wikiPages.forEach((p) => {
    const idStr = p._id.toString();
    const node = map.get(idStr);
    const parentIdStr = p.parentWikiId ? p.parentWikiId.toString() : null;

    if (parentIdStr === rootIdStr || (!parentIdStr && !rootIdStr)) {
      roots.push(node);
    } else if (map.has(parentIdStr)) {
      map.get(parentIdStr).children.push(node);
    } else {
      // If parent isn't in tree (e.g. unaccessible or broken pointer), treat as top-level
      roots.push(node);
    }
  });

  // Sort helper: wikiHome first, then wikiOrder asc, then title asc
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      if (a.isWikiHome && !b.isWikiHome) return -1;
      if (!a.isWikiHome && b.isWikiHome) return 1;
      const orderA = a.wikiOrder ?? 0;
      const orderB = b.wikiOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.title || "").localeCompare(b.title || "");
    });
    nodes.forEach((n) => {
      if (n.children && n.children.length > 0) {
        sortNodes(n.children);
      }
    });
  };

  sortNodes(roots);
  return roots;
};

/**
 * Generates a clean URL slug from title, with fallback
 *
 * @param {string} title
 * @returns {string}
 */
export const slugifyWikiTitle = (title) => {
  if (!title || typeof title !== "string") return "untitled-wiki-page";
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled-wiki-page";
};
