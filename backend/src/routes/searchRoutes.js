import express from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { searchGlobal } from "../controllers/searchController.js";

const router = express.Router();

router.use(authRequired);
router.get("/", searchGlobal);

export default router;
