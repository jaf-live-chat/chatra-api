import { AppError } from "../utils/errors.js";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 90;
const rateLimitBucket = new Map();

const normalizeValue = (value) => String(value || "").trim();

const pruneExpiredBuckets = (now) => {
  for (const [bucketKey, bucketValue] of rateLimitBucket.entries()) {
    if (now - bucketValue.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateLimitBucket.delete(bucketKey);
    }
  }
};

const liveChatWidgetRateLimit = (req, _res, next) => {
  const apiKey = normalizeValue(req.widgetApiKey || req.headers["x-api-key"]);

  if (!apiKey) {
    return next(new AppError("Missing apiKey for rate limiting.", 400));
  }

  const now = Date.now();
  pruneExpiredBuckets(now);

  const bucket = rateLimitBucket.get(apiKey) || {
    windowStart: now,
    count: 0,
  };

  if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket.windowStart = now;
    bucket.count = 0;
  }

  bucket.count += 1;
  rateLimitBucket.set(apiKey, bucket);

  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    return next(new AppError("Too many requests for this API key. Please retry shortly.", 429));
  }

  return next();
};

export default liveChatWidgetRateLimit;
