import crypto from 'crypto';

const SUCCESS_STATUSES = new Set(['completed', 'succeeded', 'paid', 'successful', 'success']);
const SUCCESS_EVENTS = new Set([
  'payment_request.completed',
  'payment_request.paid',
  'payment_request.succeeded',
  'payment_request.updated',
  'payment.succeeded',
  'payment.completed',
  'payment.paid',
  'charge.succeeded',
]);

const toLowerTrim = (value) => String(value || '').trim().toLowerCase();

const getProvidedSignature = (headers = {}, payload = {}) => {
  return (
    headers['x-hitpay-signature'] ||
    headers['x-hitpay-hmac'] ||
    headers['x-hitpay-hmac-signature'] ||
    headers['hitpay-signature'] ||
    payload?.hmac ||
    payload?.signature ||
    ''
  );
};

const buildCandidateBodies = (payload = {}) => {
  const candidates = [payload];

  if (Object.prototype.hasOwnProperty.call(payload, 'hmac')) {
    const { hmac, ...withoutHmac } = payload;
    candidates.push(withoutHmac);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'signature')) {
    const { signature, ...withoutSignature } = payload;
    candidates.push(withoutSignature);
  }

  return candidates;
};

const safelyCompareHash = (provided, expected) => {
  const providedBuffer = Buffer.from(String(provided || '').trim());
  const expectedBuffer = Buffer.from(String(expected || '').trim());

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const matchesSignature = (providedSignature, expectedHexSignature) => {
  const normalizedProvided = String(providedSignature || '').trim().replace(/^sha256=/i, '');
  const normalizedExpectedHex = String(expectedHexSignature || '').trim().toLowerCase();

  if (!normalizedProvided || !normalizedExpectedHex) {
    return false;
  }

  const providedAsHex = normalizedProvided.toLowerCase();
  if (safelyCompareHash(providedAsHex, normalizedExpectedHex)) {
    return true;
  }

  const expectedBase64 = Buffer.from(normalizedExpectedHex, 'hex').toString('base64');
  const expectedBase64Url = expectedBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  return (
    safelyCompareHash(normalizedProvided, expectedBase64) ||
    safelyCompareHash(normalizedProvided, expectedBase64Url)
  );
};

const getWebhookSalts = () => {
  const value = process.env.HITPAY_WEBHOOK_SALT || '';
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseMaybeJsonObject = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (_error) {
    return {};
  }

  return {};
};

const isAffirmative = (value) => {
  const normalized = toLowerTrim(value);
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'paid';
};

const verifyWebhookSignature = ({ payload, headers, rawBody }) => {
  const webhookSalts = getWebhookSalts();
  const providedSignature = getProvidedSignature(headers, payload);

  if (!webhookSalts.length || !providedSignature) {
    return false;
  }

  const bodyCandidates = buildCandidateBodies(payload);
  const rawCandidates = [rawBody].filter(Boolean);

  // Verify against exact raw body first (most accurate for provider-signed payloads)
  const matchesRawBody = webhookSalts.some((salt) => {
    return rawCandidates.some((raw) => {
      const expectedSignature = crypto
        .createHmac('sha256', salt)
        .update(String(raw))
        .digest('hex');

      return matchesSignature(providedSignature, expectedSignature);
    });
  });

  if (matchesRawBody) {
    return true;
  }

  // Fallback: verify against canonical JSON from parsed body
  return webhookSalts.some((salt) => bodyCandidates.some((body) => {
    const expectedSignature = crypto
      .createHmac('sha256', salt)
      .update(JSON.stringify(body))
      .digest('hex');

    return matchesSignature(providedSignature, expectedSignature);
  }));
};

const normalizeWebhookPayload = (payload = {}) => {
  const data = parseMaybeJsonObject(payload?.data);

  const payloadCustomData =
    payload?.custom_data ||
    payload?.customData ||
    payload?.metadata ||
    payload?.meta;
  const dataCustomData =
    data?.custom_data ||
    data?.customData ||
    data?.metadata ||
    data?.meta;

  const customData = {
    ...parseMaybeJsonObject(payloadCustomData),
    ...parseMaybeJsonObject(dataCustomData),
  };

  const normalizedPayloadStatus = toLowerTrim(
    payload?.status || payload?.payment_status || payload?.paymentStatus || payload?.state || ''
  );
  const normalizedDataStatus = toLowerTrim(
    data?.status || data?.payment_status || data?.paymentStatus || data?.state || ''
  );

  const eventType =
    payload?.event ||
    payload?.event_type ||
    payload?.eventType ||
    payload?.type ||
    data?.event ||
    data?.event_type ||
    data?.eventType ||
    data?.type ||
    payload?.webhookEvent ||
    '';

  const paymentId =
    payload?.payment_request_id ||
    payload?.payment_id ||
    payload?.id ||
    data?.payment_request_id ||
    data?.payment_id ||
    data?.id ||
    payload?.paymentId ||
    customData?.paymentId ||
    '';

  const paymentReference =
    payload?.reference_number ||
    payload?.referenceNumber ||
    payload?.reference ||
    data?.reference_number ||
    data?.referenceNumber ||
    data?.reference ||
    customData?.referenceNumber ||
    customData?.paymentReference ||
    paymentId ||
    '';

  const status =
    payload?.status ||
    payload?.payment_status ||
    payload?.paymentStatus ||
    payload?.state ||
    data?.status ||
    data?.payment_status ||
    data?.paymentStatus ||
    data?.state ||
    '';

  const rawAmount =
    payload?.amount ??
    payload?.payment_amount ??
    data?.amount ??
    data?.payment_amount ??
    customData?.amount ??
    0;
  const amount = Number(rawAmount);

  const normalizedStatus = toLowerTrim(status);
  const normalizedEvent = toLowerTrim(eventType);

  const paidFlag =
    payload?.paid === true ||
    data?.paid === true ||
    isAffirmative(payload?.paid) ||
    isAffirmative(data?.paid);

  const isSuccessStatus =
    SUCCESS_STATUSES.has(normalizedStatus) ||
    SUCCESS_STATUSES.has(normalizedPayloadStatus) ||
    SUCCESS_STATUSES.has(normalizedDataStatus);
  const isSuccessEvent = SUCCESS_EVENTS.has(normalizedEvent);

  return {
    eventType,
    status,
    amount: Number.isFinite(amount) ? amount : 0,
    paymentId,
    paymentReference,
    customData,
    companyId: customData?.companyId || customData?.tenantId || customData?.company_id || '',
    planId: customData?.planId || customData?.subscriptionPlanId || customData?.plan_id || '',
    userId: customData?.userId || customData?.agentId || customData?.user_id || '',
    isSuccessfulPayment: isSuccessStatus || isSuccessEvent || paidFlag,
  };
};

export default {
  verifyWebhookSignature,
  normalizeWebhookPayload,
};
