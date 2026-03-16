import expressAsyncHandler from "express-async-handler";
import agentServices from "../services/tenant/agentServices.js";
import { InternalServerError } from "../utils/errors.js";

const loginAgent = expressAsyncHandler(async (req, res) => {
  const { emailAddress, password } = req.body || {};
  const databaseName = req.tenant?.databaseName;

  if (!databaseName) {
    throw new InternalServerError("Unable to resolve tenant database for login.");
  }

  const loginResult = await agentServices.loginAgent({
    databaseName,
    tenantId: req.tenant?._id,
    emailAddress,
    password,
  });

  res.status(200).json({
    success: true,
    message: "Login successful.",
    accessToken: loginResult.accessToken,
    tokenType: loginResult.tokenType,
    expiresIn: loginResult.expiresIn,
    tenant: {
      id: req.tenant?._id,
      companyName: req.tenant?.companyName,
    },
    agent: loginResult.agent,
  });
});

export { loginAgent };