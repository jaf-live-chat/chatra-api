import crypto from 'crypto';
import axios from 'axios';

import { getEnv } from '../config/envResolver.js';

const SUCCESS_STATUSES = new Set(['completed', 'succeeded', 'paid', 'successful', 'success']);
const TERMINAL_CANCELLED_STATUSES = new Set([
  'cancelled',
  'canceled',
  'expired',
]);
const TERMINAL_FAILED_STATUSES = new Set([
  'failed',
  'void',
  'voided',
  'abandoned',
  'rejected',
  'declined',
]);
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
  const value = getEnv('HITPAY_WEBHOOK_SALT') || '';
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

const fetchPaymentRequestById = async (paymentRequestId) => {
  const apiKey = getEnv('HITPAY_API_KEY');
  const apiBaseUrl = getEnv('HITPAY_API_BASE_URL') || 'https://api.hitpay.com';

  if (!apiKey || !apiBaseUrl || !paymentRequestId) {
    return null;
  }

  try {
    const response = await axios.get(`${apiBaseUrl}/v1/payment-requests/${encodeURIComponent(paymentRequestId)}`, {
      headers: {
        'X-BUSINESS-API-KEY': apiKey,
      },
      timeout: 10000,
    });

    return response?.data || null;
  } catch (_error) {
    return null;
  }
};

const isPaymentRequestCompleted = async (paymentRequestId) => {
  const paymentRequest = await fetchPaymentRequestById(paymentRequestId);

  if (!paymentRequest || typeof paymentRequest !== 'object') {
    return false;
  }

  const statusCandidates = [
    paymentRequest?.status,
    paymentRequest?.payment_status,
    paymentRequest?.state,
    paymentRequest?.payment_request?.status,
    paymentRequest?.data?.status,
    paymentRequest?.data?.payment_status,
  ];

  const isPaidFlag =
    paymentRequest?.paid === true ||
    paymentRequest?.data?.paid === true ||
    isAffirmative(paymentRequest?.paid) ||
    isAffirmative(paymentRequest?.data?.paid);

  const hasSuccessStatus = statusCandidates.some((value) => SUCCESS_STATUSES.has(toLowerTrim(value)));

  return hasSuccessStatus || isPaidFlag;
};

const getPaymentRequestLifecycle = async (paymentRequestId) => {
  const paymentRequest = await fetchPaymentRequestById(paymentRequestId);

  if (!paymentRequest || typeof paymentRequest !== 'object') {
    return {
      paymentRequest: null,
      status: '',
      isCompleted: false,
      isFailed: false,
      isCancelled: false,
    };
  }

  const statusCandidates = [
    paymentRequest?.status,
    paymentRequest?.payment_status,
    paymentRequest?.state,
    paymentRequest?.payment_request?.status,
    paymentRequest?.data?.status,
    paymentRequest?.data?.payment_status,
    paymentRequest?.data?.state,
  ];

  const normalizedStatus = statusCandidates.map(toLowerTrim).find(Boolean) || '';
  const isPaidFlag =
    paymentRequest?.paid === true ||
    paymentRequest?.data?.paid === true ||
    isAffirmative(paymentRequest?.paid) ||
    isAffirmative(paymentRequest?.data?.paid);

  const isCompleted = SUCCESS_STATUSES.has(normalizedStatus) || isPaidFlag;
  const isFailed = !isCompleted && TERMINAL_FAILED_STATUSES.has(normalizedStatus);
  const isCancelled = !isCompleted && !isFailed && TERMINAL_CANCELLED_STATUSES.has(normalizedStatus);

  return {
    paymentRequest,
    status: normalizedStatus,
    isCompleted,
    isFailed,
    isCancelled,
  };
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

  const paymentRecordId =
    payload?.paymentRecordId ||
    payload?.payment_record_id ||
    data?.paymentRecordId ||
    data?.payment_record_id ||
    customData?.paymentRecordId ||
    customData?.payment_record_id ||
    customData?.paymentRecord?.id ||
    customData?.paymentRecord?._id ||
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
    paymentRecordId,
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
  isPaymentRequestCompleted,
  getPaymentRequestLifecycle,
};
