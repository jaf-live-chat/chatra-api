import express from "express";
import { loginValidator } from "../validations/agentValidator.js";
import { loginAgent } from "../controllers/agentControllers.js";

const router = express.Router();

router.post("/login", loginValidator, loginAgent);

export default router;