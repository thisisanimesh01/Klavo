import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createDocument,
  getDocumentsByProject,
  getDocumentById,
  updateDocument,
  deleteDocument,
} from "../controllers/documentController.js";

const router = express.Router();

router.use(authRequired);

router.post("/", createDocument);
router.get("/project/:projectId", getDocumentsByProject);
router.get("/:documentId", getDocumentById);
router.put("/:documentId", updateDocument);
router.delete("/:documentId", deleteDocument);

export default router;
