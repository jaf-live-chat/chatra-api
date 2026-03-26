import express from "express";
import { loginValidator, createAgentValidator, updateAgentValidator } from "../../validations/tenant/agentValidator.js";
import { createAgent, loginAgent, getMe, getAgents, getSingleAgentById, updateMyProfile, editAgentById, deleteAgent } from "../../controllers/tenant/agentControllers.js";
import tenantAuth from "../../middlewares/tenantAuthMiddleware.js";
import { protect, adminAuth } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", loginValidator, loginAgent);

router.get("/me", tenantAuth, protect, getMe);
router.get("/", tenantAuth, protect, getAgents);
router.get("/:id", tenantAuth, protect, getSingleAgentById);

router.post("/", tenantAuth, protect, adminAuth, createAgentValidator, createAgent);
router.put("/profile", tenantAuth, protect, updateMyProfile);
router.put("/:id", tenantAuth, protect, updateAgentValidator, editAgentById);
router.delete("/:id", tenantAuth, protect, adminAuth, deleteAgent);

export default router;