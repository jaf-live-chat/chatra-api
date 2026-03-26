import express from "express";
import { loginValidator, createAgentValidator, updateAgentValidator } from "../../validations/tenant/agentValidator.js";
import {
  createAgent,
  loginAgent,
  getMe,
  getAgents,
  getSingleAgentById,
  updateMyProfile,
  verifyMyPassword,
  editAgentById,
  deleteAgent,
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPassword,
} from "../../controllers/tenant/agentControllers.js";
import tenantAuth from "../../middlewares/tenantAuthMiddleware.js";
import { protect, adminAuth } from "../../middlewares/authMiddleware.js";
import { uploadSingle } from "../../middlewares/fileUploadMiddleware.js";

const router = express.Router();

router.post("/login", loginValidator, loginAgent);

// Public password reset endpoints (no auth required)
router.post("/forgot-password", requestPasswordReset);
router.post("/verify-otp", verifyPasswordResetOTP);
router.post("/reset-password", resetPassword);

router.get("/me", tenantAuth, protect, getMe);
router.get("/", tenantAuth, protect, getAgents);
router.post("/verify-password", tenantAuth, protect, verifyMyPassword);
router.get("/:id", tenantAuth, protect, getSingleAgentById);

router.post("/", tenantAuth, protect, adminAuth, createAgentValidator, createAgent);
router.put("/profile", tenantAuth, protect, uploadSingle("avatar", { fileCategory: "IMAGES" }), updateMyProfile);
router.put("/:id", tenantAuth, protect, updateAgentValidator, editAgentById);
router.delete("/:id", tenantAuth, protect, adminAuth, deleteAgent);

export default router;