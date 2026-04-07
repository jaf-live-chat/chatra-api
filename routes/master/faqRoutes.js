import express from "express";
import {
  createFAQ,
  deleteFAQById,
  getFAQById,
  getFAQsByQuery,
  reorderFAQs,
  updateFAQById,
} from "../../controllers/master/faqControllers.js";
import { masterAdminAuth, protect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", getFAQsByQuery);
router.patch("/reorder", protect, masterAdminAuth, reorderFAQs);
router.get("/:id", getFAQById);
router.post("/", protect, masterAdminAuth, createFAQ);
router.put("/:id", protect, masterAdminAuth, updateFAQById);
router.delete("/:id", protect, masterAdminAuth, deleteFAQById);

export default router;
