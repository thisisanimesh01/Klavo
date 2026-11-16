import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createDocument,
  getDocumentsByProject,
  getDocumentById,
  updateDocument,
  deleteDocument,
} from "../controllers/documentController.js";
import {
  createFolder,
  getFoldersByProject,
  getFolderById,
  updateFolder,
  deleteFolder,
} from "../controllers/documentFolderController.js";

const router = express.Router();

router.use(authRequired);

// Document CRUD
router.post("/", createDocument);
router.get("/project/:projectId", getDocumentsByProject);
router.get("/:documentId", getDocumentById);
router.put("/:documentId", updateDocument);
router.delete("/:documentId", deleteDocument);

// Document Folder CRUD & Hierarchy
router.post("/folders", createFolder);
router.get("/folders/project/:projectId", getFoldersByProject);
router.get("/folders/:folderId", getFolderById);
router.put("/folders/:folderId", updateFolder);
router.delete("/folders/:folderId", deleteFolder);

export default router;
