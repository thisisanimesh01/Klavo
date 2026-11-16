import DocumentFolder from "../models/DocumentFolder.js";

/**
 * Validates that setting `targetParentId` as parent of `folderId` does not create a circular dependency.
 * Traversing upward from `targetParentId` must never encounter `folderId`.
 *
 * @param {string|ObjectId} folderId - The folder being moved
 * @param {string|ObjectId|null} targetParentId - The intended new parent folder
 * @returns {Promise<{isCircular: boolean, path: string[]}>}
 */
export const checkCircularFolderNesting = async (folderId, targetParentId) => {
  if (!targetParentId) {
    return { isCircular: false, path: [] };
  }

  const folderIdStr = folderId.toString();
  const targetParentIdStr = targetParentId.toString();

  // Self-nesting check
  if (folderIdStr === targetParentIdStr) {
    return { isCircular: true, path: [folderIdStr, targetParentIdStr] };
  }

  const visited = [targetParentIdStr];
  let currId = targetParentId;

  // Traverse ancestors upward to root
  while (currId) {
    const parentFolder = await DocumentFolder.findById(currId).select("parentId name");
    if (!parentFolder) break;

    const ancestorIdStr = parentFolder.parentId ? parentFolder.parentId.toString() : null;

    if (ancestorIdStr === folderIdStr) {
      visited.push(folderIdStr);
      return { isCircular: true, path: visited };
    }

    if (ancestorIdStr) {
      // Loop guard in existing corrupt tree
      if (visited.includes(ancestorIdStr)) {
        return { isCircular: true, path: visited };
      }
      visited.push(ancestorIdStr);
    }

    currId = parentFolder.parentId;
  }

  return { isCircular: false, path: visited };
};

/**
 * Recursively resolves the full ancestry path (breadcrumbs) for a folder.
 * Returns array from root folder down to the target folder: [{ _id, name }]
 *
 * @param {string|ObjectId|null} folderId
 * @returns {Promise<Array<{_id: string, name: string}>>}
 */
export const getFolderBreadcrumbs = async (folderId) => {
  if (!folderId) return [];

  const crumbs = [];
  let currId = folderId;
  const seen = new Set();

  while (currId) {
    if (seen.has(currId.toString())) break;
    seen.add(currId.toString());

    const folder = await DocumentFolder.findById(currId).select("_id name parentId");
    if (!folder) break;

    crumbs.unshift({ _id: folder._id, name: folder.name });
    currId = folder.parentId;
  }

  return crumbs;
};

/**
 * Retrieves all descendant folder IDs under a given folder recursively.
 *
 * @param {string|ObjectId} folderId
 * @param {string|ObjectId} projectId
 * @returns {Promise<Array<ObjectId>>}
 */
export const getDescendantFolderIds = async (folderId, projectId) => {
  const descendantIds = [];
  let currentLayer = [folderId];

  while (currentLayer.length > 0) {
    const children = await DocumentFolder.find({
      projectId,
      parentId: { $in: currentLayer },
    }).select("_id");

    if (children.length === 0) break;

    const childIds = children.map((c) => c._id);
    descendantIds.push(...childIds);
    currentLayer = childIds;
  }

  return descendantIds;
};
