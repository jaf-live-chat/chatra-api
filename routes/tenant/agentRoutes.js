import express from "express";
import { loginValidator, createAgentValidator } from "../../validations/agentValidator.js";
import { createAgent, loginAgent } from "../../controllers/tenant/agentControllers.js";
import tenantAuth from "../../middlewares/tenantAuthMiddleware.js";

const router = express.Router();

router.post("/", tenantAuth, createAgentValidator, createAgent);
router.post("/login", loginValidator, loginAgent);

export default router;