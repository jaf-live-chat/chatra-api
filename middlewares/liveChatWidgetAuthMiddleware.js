import tenantAuth from "./tenantAuthMiddleware.js";

const normalizeValue = (value) => String(value || "").trim();

const resolveApiKey = (req) => {
  const headerApiKey = req.headers["x-api-key"];
  if (headerApiKey) {
    return headerApiKey;
  }

  if (req.query?.apiKey) {
    return req.query.apiKey;
  }

  return req.body?.apiKey;
};

const liveChatWidgetAuth = (req, res, next) => {
  const resolvedApiKey = normalizeValue(resolveApiKey(req));

  if (resolvedApiKey && !req.headers["x-api-key"]) {
    req.headers["x-api-key"] = resolvedApiKey;
  }

  return tenantAuth(req, res, (error) => {
    if (error) {
      return next(error);
    }

    req.widgetApiKey = normalizeValue(req.headers["x-api-key"]);
    return next();
  });
};

export default liveChatWidgetAuth;
