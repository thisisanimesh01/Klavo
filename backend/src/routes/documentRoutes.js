import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createDocument,
  getDocumentsByProject,
  getDocumentById,
  updateDocument,
  shareDocument,
  revokeDocumentShare,
  transferDocumentOwnership,
  deleteDocument,
} from "../controllers/documentController.js";
import {
  createFolder,
  getFoldersByProject,
  getFolderById,
  updateFolder,
  deleteFolder,
} from "../controllers/documentFolderController.js";
import {
  createDocumentComment,
  getDocumentComments,
  updateDocumentComment,
  toggleResolveComment,
  deleteDocumentComment,
} from "../controllers/documentCommentController.js";
import {
  createNamedSnapshot,
  getDocumentVersions,
  getDocumentVersionById,
  compareDocumentVersions,
  restoreDocumentVersion,
} from "../controllers/documentVersionController.js";
import {
  createWikiPage,
  getWikiPagesByProject,
  getWikiHome,
  getWikiPageById,
  updateWikiPage,
  reorderWikiPages,
  deleteWikiPage,
} from "../controllers/wikiController.js";

import {
  getDocumentLinkedTasks,
  getProjectLinkedDocuments,
} from "../controllers/documentLinkController.js";

const router = express.Router();

router.use(authRequired);

// Project Linked Documents Overview (DOC-08)
router.get("/project/:projectId/linked-documents", getProjectLinkedDocuments);

// Reverse Document-to-Tasks Association (DOC-08)
router.get("/:documentId/tasks", getDocumentLinkedTasks);

// Wiki & Knowledge Base (DOC-07)
router.post("/wiki", createWikiPage);
router.get("/wiki/project/:projectId", getWikiPagesByProject);
router.get("/wiki/project/:projectId/home", getWikiHome);
router.post("/wiki/project/:projectId/reorder", reorderWikiPages);
router.get("/wiki/:documentId", getWikiPageById);
router.put("/wiki/:documentId", updateWikiPage);
router.delete("/wiki/:documentId", deleteWikiPage);

// Document CRUD & Sharing
router.post("/", createDocument);
router.get("/project/:projectId", getDocumentsByProject);
router.get("/:documentId", getDocumentById);
router.put("/:documentId", updateDocument);
router.delete("/:documentId", deleteDocument);

// Granular Document Sharing & Ownership
router.post("/:documentId/share", shareDocument);
router.delete("/:documentId/share/:targetUserId", revokeDocumentShare);
router.post("/:documentId/transfer-ownership", transferDocumentOwnership);

// Document Comments & Discussions (DOC-05)
router.post("/:documentId/comments", createDocumentComment);
router.get("/:documentId/comments", getDocumentComments);
router.put("/comments/:commentId", updateDocumentComment);
router.patch("/comments/:commentId/resolve", toggleResolveComment);
router.delete("/comments/:commentId", deleteDocumentComment);

// Document Version History & Recovery (DOC-06)
router.post("/:documentId/versions", createNamedSnapshot);
router.get("/:documentId/versions", getDocumentVersions);
router.get("/:documentId/versions/compare", compareDocumentVersions);
router.get("/:documentId/versions/:versionId", getDocumentVersionById);
router.post("/:documentId/versions/:versionId/restore", restoreDocumentVersion);

// Document Folder CRUD & Hierarchy
router.post("/folders", createFolder);
router.get("/folders/project/:projectId", getFoldersByProject);
router.get("/folders/:folderId", getFolderById);
router.put("/folders/:folderId", updateFolder);
router.delete("/folders/:folderId", deleteFolder);

export default router;
