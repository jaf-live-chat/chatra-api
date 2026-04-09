import { InternalServerError } from "./errors.js";

const resolveTenantDatabaseName = (req, options = {}) => {
  const { errorMessage = "Unable to resolve tenant database." } = options;
  const databaseName = req.tenant?.databaseName;

  if (!databaseName) {
    throw new InternalServerError(errorMessage);
  }

  return databaseName;
};

export { resolveTenantDatabaseName };
