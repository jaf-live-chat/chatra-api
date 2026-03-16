import express from "express";
import tenantAuth from "../middlewares/tenantAuthMiddleware.js";
import { loginValidator } from "../validations/agentValidator.js";
import { loginAgent } from "../controllers/agentControllers.js";

const router = express.Router();

router.post("/login", tenantAuth, loginValidator, loginAgent);

export default router;