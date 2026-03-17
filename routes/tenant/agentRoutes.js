import express from "express";
import { loginValidator, createAgentValidator, updateAgentValidator } from "../../validations/tenant/agentValidator.js";
import { createAgent, loginAgent, getAgents, getAgentById, updateAgent, deleteAgent } from "../../controllers/tenant/agentControllers.js";
import tenantAuth from "../../middlewares/tenantAuthMiddleware.js";
import { protect, adminAuth } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", loginValidator, loginAgent);

router.get("/", tenantAuth, protect, getAgents);
router.get("/:agentId", tenantAuth, protect, getAgentById);

router.post("/", tenantAuth, protect, adminAuth, createAgentValidator, createAgent);
router.put("/:agentId", tenantAuth, protect, adminAuth, updateAgentValidator, updateAgent);
router.delete("/:agentId", tenantAuth, protect, adminAuth, deleteAgent);

export default router;