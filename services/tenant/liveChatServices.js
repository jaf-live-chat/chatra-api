import axios from "axios";
import { getTenantConnection } from "../../config/tenantDB.js";
import { CONVERSATION_STATUS, QUEUE_STATUS, USER_ROLES, USER_STATUS } from "../../constants/constants.js";
import { AppError, BadRequestError, ForbiddenError, InternalServerError, NotFoundError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { isAdminOrMasterRole } from "../../utils/roleGuards.js";
import { broadcastLiveChatEvent } from "../liveChatRealtime.js";
import notificationServices from "./notificationServices.js";
import { broadcastTenantNotification } from "../notificationBroadcaster.js";
import { getConversationFeedbackMap } from "./conversationFeedbackServices.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_CONCURRENT_AGENT_CHATS = 2;

const MESSAGE_STATUS = {
  DELIVERED: "DELIVERED",
  SEEN: "SEEN",
};

const normalizeText = (value, fallback = "") => String(value ?? fallback).trim();

const parseBooleanLike = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  return String(value ?? "").toLowerCase() === "true";
};

const ensureDatabaseName = (databaseName) => {
  if (!databaseName) {
    throw new BadRequestError("databaseName is required.");
  }
};

const parsePagination = (page, limit) => {
  const pageNumber = Math.max(1, Number.parseInt(String(page || DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limitNumber = Math.max(1, Math.min(100, Number.parseInt(String(limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  return {
    page: pageNumber,
    limit: limitNumber,
    skip: (pageNumber - 1) * limitNumber,
  };
};

const safeObject = (value) => {
  if (!value) return null;
  return typeof value.toObject === "function" ? value.toObject() : { ...value };
};

const sanitizeVisitor = (visitor) => {
  const visitorObject = safeObject(visitor);
  if (!visitorObject) return null;

  return visitorObject;
};

const sanitizeAgent = (agent) => {
  const agentObject = safeObject(agent);
  if (!agentObject) return null;

  delete agentObject.password;
  const fullName = normalizeText(agentObject.fullName);
  const agentId = normalizeText(agentObject._id);

  if (fullName && agentId) {
    agentObject.displayName = `${fullName} (${agentId})`;
  } else if (fullName) {
    agentObject.displayName = fullName;
  } else if (agentId) {
    agentObject.displayName = agentId;
  }

  return agentObject;
};

const sanitizeConversation = (conversation) => {
  const conversationObject = safeObject(conversation);
  if (!conversationObject) return null;

  return conversationObject;
};

const sanitizeQueueEntry = (queueEntry) => {
  const queueObject = safeObject(queueEntry);
  if (!queueObject) return null;

  return queueObject;
};

const buildLocationLabel = (city, country) => {
  const normalizedCity = normalizeText(city);
  const normalizedCountry = normalizeText(country);

  if (normalizedCity && normalizedCountry) {
    return `${normalizedCity}, ${normalizedCountry}`;
  }

  if (normalizedCity) {
    return normalizedCity;
  }

  if (normalizedCountry) {
    return normalizedCountry;
  }

  return "Unknown location";
};

const buildLocationSourceLabel = (source) => {
  const normalizedSource = normalizeText(source);

  if (!normalizedSource) {
    return "Unknown source";
  }

  return normalizedSource
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const sanitizeMessage = (message) => {
  const messageObject = safeObject(message);
  if (!messageObject) return null;

  return messageObject;
};

const buildVisitorDisplayName = (visitor) => {
  const normalizedName = normalizeText(visitor?.name);
  if (normalizedName) {
    return normalizedName;
  }

  const normalizedEmail = normalizeText(visitor?.emailAddress);
  if (normalizedEmail) {
    return normalizedEmail;
  }

  const token = normalizeText(visitor?.visitorToken);
  if (token) {
    return `Visitor ${token.slice(-6)}`;
  }

  return "Website Visitor";
};

const resolveRequestIpAddress = (req) => {
  const cfConnectingIp = normalizeText(req.headers["cf-connecting-ip"]);
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const xRealIp = normalizeText(req.headers["x-real-ip"]);
  if (xRealIp) {
    return xRealIp;
  }

  const forwardedFor = normalizeText(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim() || "UNKNOWN";
  }

  const socketAddress = normalizeText(req.socket?.remoteAddress);
  return socketAddress || "UNKNOWN";
};

const resolveUserAgent = (req) => normalizeText(req.headers["user-agent"], "UNKNOWN") || "UNKNOWN";

const isPrivateIpAddress = (ipAddress) => {
  const normalizedIp = normalizeText(ipAddress).toLowerCase();

  if (!normalizedIp || normalizedIp === "unknown") {
    return true;
  }

  if (normalizedIp === "::1" || normalizedIp === "[::1]") {
    return true;
  }

  if (normalizedIp.startsWith("10.") || normalizedIp.startsWith("192.168.") || normalizedIp.startsWith("127.")) {
    return true;
  }

  if (normalizedIp.startsWith("172.")) {
    const secondOctet = Number.parseInt(normalizedIp.split(".")[1] || "0", 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  if (normalizedIp.startsWith("fc") || normalizedIp.startsWith("fd") || normalizedIp.startsWith("fe80")) {
    return true;
  }

  return false;
};

const normalizeCoordinate = (value) => {
  const parsedValue = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const resolveVisitorLocationFromBrowserCoordinates = async (browserLatitude, browserLongitude) => {
  const latitude = normalizeCoordinate(browserLatitude);
  const longitude = normalizeCoordinate(browserLongitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: {
        format: "jsonv2",
        lat: latitude,
        lon: longitude,
        zoom: 10,
        addressdetails: 1,
      },
      timeout: 3500,
      headers: {
        "User-Agent": "JAF Chatra Live Chat/1.0",
        Accept: "application/json",
      },
    });

    const data = response?.data || {};
    const address = data.address || {};
    const city = normalizeText(address.city || address.town || address.village || address.hamlet || address.municipality || data.name);
    const country = normalizeText(address.country);

    if (!city && !country) {
      return null;
    }

    return {
      city: city || null,
      country: country || null,
      source: "BROWSER_GEOLOCATION",
      resolvedAt: new Date(),
    };
  } catch (error) {
    logger.debug?.(`Browser location lookup failed for ${latitude},${longitude}: ${error.message}`);
    return null;
  }
};

const resolveVisitorLocationFromIp = async (ipAddress) => {
  if (isPrivateIpAddress(ipAddress)) {
    return null;
  }

  try {
    const response = await axios.get(`https://ipwho.is/${encodeURIComponent(ipAddress)}`, {
      timeout: 2500,
    });
    const data = response?.data || {};

    if (!data.success) {
      return null;
    }

    const city = normalizeText(data.city);
    const country = normalizeText(data.country);

    if (!city && !country) {
      return null;
    }

    return {
      city: city || null,
      country: country || null,
      source: "IP_GEOLOCATION",
      resolvedAt: new Date(),
    };
  } catch (error) {
    logger.debug?.(`Visitor location lookup failed for ${ipAddress}: ${error.message}`);
    return null;
  }
};

const resolveVisitorLocation = async (ipAddress, locationConsent, browserLatitude = null, browserLongitude = null) => {
  if (!locationConsent) {
    return null;
  }

  const browserLocation = await resolveVisitorLocationFromBrowserCoordinates(browserLatitude, browserLongitude);
  if (browserLocation) {
    return browserLocation;
  }

  return resolveVisitorLocationFromIp(ipAddress);
};

const resolveVisitorToken = (req, payload = {}) => {
  return normalizeText(req.headers["x-visitor-id"] || payload.visitorToken || payload.visitorId);
};

const assertVisitorConversationAccess = ({ conversation, requestVisitorToken, visitor }) => {
  if (!requestVisitorToken) {
    throw new ForbiddenError("visitorToken is required for visitor actions.");
  }

  const conversationVisitorToken = normalizeText(conversation?.visitorToken);
  if (conversationVisitorToken && conversationVisitorToken !== requestVisitorToken) {
    throw new ForbiddenError("Conversation access denied for this visitor token.");
  }

  const persistedVisitorToken = normalizeText(visitor?.visitorToken);
  if (persistedVisitorToken && persistedVisitorToken !== requestVisitorToken) {
    throw new ForbiddenError("Conversation access denied for this visitor token.");
  }
};

const getTenantModels = (databaseName) => {
  ensureDatabaseName(databaseName);
  return getTenantConnection(databaseName);
};

const getOrCreateChatSettings = async (databaseName) => {
  const { ChatSettings } = getTenantModels(databaseName);
  const chatSettings = await ChatSettings.findOne().lean();

  if (chatSettings) {
    return chatSettings;
  }

  const [createdChatSettings] = await ChatSettings.create([
    {
      assignmentMode: "ROUND_ROBIN",
      roundRobinPointer: 0,
    },
  ]);

  return safeObject(createdChatSettings);
};

const getAssignmentMode = async (databaseName) => {
  const chatSettings = await getOrCreateChatSettings(databaseName);
  return String(chatSettings?.assignmentMode || "ROUND_ROBIN").toUpperCase();
};

const upsertVisitor = async (databaseName, payload, req, visitorLocation = null) => {
  const { Visitors } = getTenantModels(databaseName);
  const visitorToken = resolveVisitorToken(req, payload);
  const visitorName = normalizeText(payload.fullName || payload.name);
  const emailAddress = normalizeText(payload.emailAddress).toLowerCase();
  const phoneNumber = normalizeText(payload.phoneNumber);
  const ipAddressConsent = parseBooleanLike(payload.ipAddressConsent ?? payload.locationConsent);
  const ipAddress = ipAddressConsent ? resolveRequestIpAddress(req) : "CONSENT_DENIED";
  const locationConsent = parseBooleanLike(payload.locationConsent);

  let visitor = null;

  if (visitorToken) {
    visitor = await Visitors.findOne({ visitorToken });
  }

  if (visitor) {
    visitor.lastSeenAt = new Date();
    visitor.ipAddressConsent = ipAddressConsent;
    visitor.ipAddress = ipAddress;
    visitor.locationConsent = locationConsent;

    if (visitorLocation) {
      visitor.locationCity = visitorLocation.city;
      visitor.locationCountry = visitorLocation.country;
      visitor.locationSource = visitorLocation.source;
      visitor.locationResolvedAt = visitorLocation.resolvedAt;
    }

    if (visitorName) {
      visitor.name = visitorName;
    }

    if (emailAddress) {
      visitor.emailAddress = emailAddress;
    }

    if (phoneNumber) {
      visitor.phoneNumber = phoneNumber;
    }

    if (visitorToken && !visitor.visitorToken) {
      visitor.visitorToken = visitorToken;
    }

    await visitor.save();
    return sanitizeVisitor(visitor);
  }

  const [createdVisitor] = await Visitors.create([
    {
      visitorToken: visitorToken || null,
      name: visitorName || undefined,
      emailAddress: emailAddress || undefined,
      phoneNumber: phoneNumber || null,
      ipAddressConsent,
      ipAddress,
      locationConsent,
      locationCity: visitorLocation?.city || null,
      locationCountry: visitorLocation?.country || null,
      locationSource: visitorLocation?.source || null,
      locationResolvedAt: visitorLocation?.resolvedAt || null,
      lastSeenAt: new Date(),
    },
  ]);

  return sanitizeVisitor(createdVisitor);
};

const getConversationOrFail = async (databaseName, conversationId) => {
  const { Conversations, Queue } = getTenantModels(databaseName);

  const conversation = await Conversations.findById(conversationId)
    .populate("visitorId")
    .populate("agentId")
    .lean();

  if (!conversation) {
    throw new NotFoundError("Conversation not found.");
  }

  const queueEntry = await Queue.findOne({ conversationId }).lean();

  return {
    conversation,
    queueEntry,
  };
};

const getOpenConversationCount = async (databaseName, agentId) => {
  const { Conversations } = getTenantModels(databaseName);

  return Conversations.countDocuments({
    agentId,
    status: CONVERSATION_STATUS.OPEN,
  });
};

const syncAgentAvailability = async (databaseName, agentId) => {
  if (!agentId) {
    return null;
  }

  const { Agents } = getTenantModels(databaseName);
  const openConversationCount = await getOpenConversationCount(databaseName, agentId);
  const nextStatus = openConversationCount > 0 ? USER_STATUS.BUSY : USER_STATUS.AVAILABLE;

  const updatedAgent = await Agents.findByIdAndUpdate(
    agentId,
    {
      status: nextStatus,
    },
    {
      new: true,
      runValidators: true,
    },
  ).lean();

  if (updatedAgent) {
    broadcastLiveChatEvent(
      { databaseName },
      "AGENT_STATUS_UPDATED",
      { agent: sanitizeAgent(updatedAgent) },
    );
  }

  return updatedAgent;
};

const claimAgent = async (databaseName, agentId) => {
  const { Agents } = getTenantModels(databaseName);
  const agent = await Agents.findById(agentId).lean();

  if (!agent) {
    return null;
  }

  const normalizedStatus = String(agent.status || "").toUpperCase();
  if ([USER_STATUS.OFFLINE, USER_STATUS.AWAY].includes(normalizedStatus)) {
    return null;
  }

  const openConversationCount = await getOpenConversationCount(databaseName, agentId);
  if (openConversationCount >= MAX_CONCURRENT_AGENT_CHATS) {
    await syncAgentAvailability(databaseName, agentId);
    return null;
  }

  return agent;
};

const releaseAgent = async (databaseName, agentId) => {
  if (!agentId) {
    return;
  }

  await syncAgentAvailability(databaseName, agentId);
};

const buildConversationResponse = (conversation, queueEntry, visitor, agent, message = null) => ({
  conversation: sanitizeConversation(conversation),
  queueEntry: sanitizeQueueEntry(queueEntry),
  visitor: sanitizeVisitor(visitor),
  agent: sanitizeAgent(agent),
  initialMessage: message ? sanitizeMessage(message) : null,
  location: {
    city: normalizeText(conversation?.locationCity || visitor?.locationCity) || null,
    country: normalizeText(conversation?.locationCountry || visitor?.locationCountry) || null,
    source: normalizeText(conversation?.locationSource || visitor?.locationSource) || null,
    consentGranted: Boolean(conversation?.locationConsent ?? visitor?.locationConsent),
    resolvedAt: conversation?.locationResolvedAt || visitor?.locationResolvedAt || null,
  },
});

const buildEndedByMetadata = (conversationResponse) => {
  const conversation = conversationResponse?.conversation || {};
  const visitor = conversationResponse?.visitor || null;
  const agent = conversationResponse?.agent || null;
  const endedByRole = normalizeText(conversation.closedByRole).toUpperCase();
  const endedById = conversation.closedById ? String(conversation.closedById) : "";

  let displayName = "Unknown";

  if (endedByRole === USER_ROLES.VISITOR.value) {
    const visitorName = normalizeText(visitor?.name || visitor?.fullName);
    const visitorToken = normalizeText(visitor?.visitorToken);
    displayName = visitorName || (visitorToken ? `Visitor ${visitorToken.slice(-4)}` : "Visitor");
  } else if (agent) {
    displayName = normalizeText(agent.fullName, "Support Agent") || "Support Agent";
  } else {
    displayName = "Support Agent";
  }

  return {
    role: endedByRole || null,
    id: endedById || null,
    displayName,
    endedAt: conversation.closedAt || null,
  };
};

const emitQueueUpdated = (databaseName, reason, response) => {
  if (!databaseName) {
    return;
  }

  broadcastLiveChatEvent(
    { databaseName },
    "QUEUE_UPDATED",
    {
      reason,
      conversationId: String(response?.conversation?._id || ""),
      queueEntry: response?.queueEntry || null,
      conversation: response?.conversation || null,
    },
  );
};

const resolveQueuePositionForConversation = async (databaseName, conversationId) => {
  if (!databaseName || !conversationId) {
    return null;
  }

  const { Conversations, Queue } = getTenantModels(databaseName);
  const queueEntry = await Queue.findOne({
    conversationId,
    status: QUEUE_STATUS.WAITING,
    endedAt: null,
  })
    .select({ queuedAt: 1 })
    .lean();

  if (!queueEntry?.queuedAt) {
    return null;
  }

  const conversation = await Conversations.findById(conversationId)
    .select({ _id: 1, visitorToken: 1, status: 1 })
    .lean();

  if (!conversation || conversation.status !== CONVERSATION_STATUS.WAITING) {
    return null;
  }

  const positionsAhead = await Queue.countDocuments({
    status: QUEUE_STATUS.WAITING,
    endedAt: null,
    queuedAt: {
      $lt: queueEntry.queuedAt,
    },
  });

  return {
    conversationId: String(conversation._id),
    visitorToken: normalizeText(conversation.visitorToken),
    position: positionsAhead + 1,
    positionsAhead,
  };
};

const emitQueuePositionChanged = async (databaseName, conversationId, reason = "POSITION_UPDATED") => {
  const queuePosition = await resolveQueuePositionForConversation(databaseName, conversationId);

  if (!queuePosition?.conversationId || !queuePosition?.visitorToken) {
    return null;
  }

  const payload = {
    conversationId: queuePosition.conversationId,
    position: queuePosition.position,
    positionsAhead: queuePosition.positionsAhead,
    reason,
    timestamp: new Date().toISOString(),
  };

  broadcastLiveChatEvent(
    {
      databaseName,
      visitorToken: queuePosition.visitorToken,
      conversationId: queuePosition.conversationId,
    },
    "QUEUE_POSITION_CHANGED",
    payload,
  );

  return payload;
};

const notifyWaitingVisitorsAfterQueueRemoval = async (databaseName, removedQueuedAt, reason = "MOVED_UP") => {
  if (!databaseName || !removedQueuedAt) {
    return;
  }

  const { Queue } = getTenantModels(databaseName);
  const impactedQueueEntries = await Queue.find({
    status: QUEUE_STATUS.WAITING,
    endedAt: null,
    queuedAt: {
      $gt: removedQueuedAt,
    },
  })
    .sort({ queuedAt: 1, createdAt: 1 })
    .select({ conversationId: 1 })
    .lean();

  for (const entry of impactedQueueEntries) {
    const impactedConversationId = String(entry?.conversationId || "");

    if (!impactedConversationId) {
      continue;
    }

    await emitQueuePositionChanged(databaseName, impactedConversationId, reason);
  }
};

const createAndBroadcastTenantNotification = async (
  databaseName,
  agentId,
  {
    type,
    title,
    message,
    relatedData = {},
  },
) => {
  try {
    if (!databaseName || !agentId || !type || !title || !message) {
      return null;
    }

    const notification = await notificationServices.createNotification(databaseName, {
      agentId,
      type,
      title,
      message,
      relatedData,
    });

    if (notification?._id) {
      broadcastTenantNotification(databaseName, String(agentId), notification);
    }

    return notification;
  } catch (error) {
    logger.warn(`[NOTIFICATION] Failed to create/broadcast tenant notification: ${error.message}`);
    return null;
  }
};

const notifyStaffAboutWaitingQueue = async (databaseName, queueContext = {}) => {
  try {
    const { Agents } = getTenantModels(databaseName);
    const staffAgents = await Agents.find(
      {
        role: {
          $in: [USER_ROLES.ADMIN.value, USER_ROLES.SUPPORT_AGENT.value],
        },
      },
      { _id: 1 },
    ).lean();

    if (!Array.isArray(staffAgents) || staffAgents.length === 0) {
      return;
    }

    const visitorName = normalizeText(queueContext?.visitorName);
    const title = "New queue item";
    const message = visitorName
      ? `${visitorName} is waiting in queue.`
      : "A new visitor is waiting in queue.";

    await Promise.all(
      staffAgents.map((agent) => createAndBroadcastTenantNotification(databaseName, String(agent._id), {
        type: "QUEUE",
        title,
        message,
        relatedData: {
          queueId: queueContext?.queueEntryId || null,
          queueEntryId: queueContext?.queueEntryId || null,
          conversationId: queueContext?.conversationId || null,
          visitorName: visitorName || null,
          metadata: {
            reason: "NEW_WAITING_CONVERSATION",
          },
        },
      })),
    );
  } catch (error) {
    logger.warn(`[NOTIFICATION] Failed to notify queue staff: ${error.message}`);
  }
};

const resolveVisitorMessageNotificationRecipients = async (databaseName, conversation = {}) => {
  const recipients = new Set();

  const directAgentId = normalizeText(conversation?.agentId);
  if (directAgentId) {
    recipients.add(directAgentId);
  }

  if (recipients.size > 0) {
    return Array.from(recipients);
  }

  const { Queue, Agents } = getTenantModels(databaseName);
  const queueEntry = await Queue.findOne({
    conversationId: conversation?._id,
    status: QUEUE_STATUS.ASSIGNED,
    endedAt: null,
    agentId: { $ne: null },
  })
    .select({ agentId: 1 })
    .lean();

  const queueAgentId = normalizeText(queueEntry?.agentId);
  if (queueAgentId) {
    recipients.add(queueAgentId);
  }

  if (recipients.size > 0) {
    return Array.from(recipients);
  }

  const fallbackAgents = await Agents.find(
    {
      role: { $in: [USER_ROLES.ADMIN.value, USER_ROLES.SUPPORT_AGENT.value] },
      status: { $ne: USER_STATUS.OFFLINE },
    },
    { _id: 1 },
  ).lean();

  fallbackAgents.forEach((agent) => {
    const id = normalizeText(agent?._id);
    if (id) {
      recipients.add(id);
    }
  });

  return Array.from(recipients);
};

const createConversation = async (payload = {}, req = {}) => {
  try {
    const { databaseName } = payload;
    ensureDatabaseName(databaseName);

    const chatSettings = await getOrCreateChatSettings(databaseName);
    const locationConsent = parseBooleanLike(payload.locationConsent);
    const ipAddressConsent = parseBooleanLike(payload.ipAddressConsent ?? payload.locationConsent);
    const requestIpAddress = ipAddressConsent ? resolveRequestIpAddress(req) : "CONSENT_DENIED";
    const visitorLocation = await resolveVisitorLocation(
      requestIpAddress,
      locationConsent,
      payload.browserLatitude,
      payload.browserLongitude,
    );
    const visitor = await upsertVisitor(databaseName, payload, req, visitorLocation);
    const visitorToken = resolveVisitorToken(req, payload) || null;
    const { Conversations, Queue, Messages, Agents } = getTenantModels(databaseName);
    const now = new Date();

    const conversationBase = {
      visitorId: visitor._id,
      visitorToken,
      ipAddress: requestIpAddress,
      locationCity: visitorLocation?.city || null,
      locationCountry: visitorLocation?.country || null,
      locationSource: visitorLocation?.source || null,
      locationConsent,
      locationResolvedAt: visitorLocation?.resolvedAt || null,
      status: CONVERSATION_STATUS.WAITING,
      queuedAt: now,
      assignedAt: null,
      agentId: null,
    };

    let selectedAgent = null;

    if (String(chatSettings.assignmentMode || "ROUND_ROBIN").toUpperCase() === "ROUND_ROBIN") {
      const availableAgents = await Agents.find({
        role: USER_ROLES.SUPPORT_AGENT.value,
        status: { $in: [USER_STATUS.AVAILABLE, USER_STATUS.BUSY] },
      })
        .sort({ createdAt: 1 })
        .lean();

      if (availableAgents.length > 0) {
        const updatedChatSettings = await getTenantModels(databaseName).ChatSettings.findOneAndUpdate(
          {},
          { $inc: { roundRobinPointer: 1 } },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            runValidators: true,
          },
        ).lean();

        const startIndex = Math.max(0, ((updatedChatSettings?.roundRobinPointer || 1) - 1) % availableAgents.length);

        for (let offset = 0; offset < availableAgents.length; offset += 1) {
          const candidate = availableAgents[(startIndex + offset) % availableAgents.length];
          const claimedAgent = await claimAgent(databaseName, candidate._id);

          if (claimedAgent) {
            selectedAgent = claimedAgent;
            break;
          }
        }
      }
    }

    const conversationPayload = {
      ...conversationBase,
    };

    if (selectedAgent) {
      conversationPayload.agentId = selectedAgent._id;
      conversationPayload.status = CONVERSATION_STATUS.OPEN;
      conversationPayload.assignedAt = now;
    }

    const [conversation] = await Conversations.create([conversationPayload]);

    const [queueEntry] = await Queue.create([
      {
        conversationId: conversation._id,
        visitorId: visitor._id,
        agentId: selectedAgent?._id || null,
        status: selectedAgent ? QUEUE_STATUS.ASSIGNED : QUEUE_STATUS.WAITING,
        assignmentMode: selectedAgent ? "ROUND_ROBIN" : String(chatSettings.assignmentMode || "MANUAL").toUpperCase(),
        queuedAt: now,
        assignedAt: selectedAgent ? now : null,
        endedAt: null,
      },
    ]);

    if (selectedAgent) {
      await syncAgentAvailability(databaseName, selectedAgent._id);
    }

    let initialMessage = null;
    const initialText = normalizeText(payload.message);

    if (initialText) {
      const [message] = await Messages.create([
        {
          conversationId: conversation._id,
          senderType: USER_ROLES.VISITOR.value,
          senderId: visitor._id,
          message: initialText,
        },
      ]);

      initialMessage = message;
    }

    const newConversationResponse = buildConversationResponse(conversation, queueEntry, visitor, selectedAgent, initialMessage);

    let queuePosition = null;
    if (!selectedAgent) {
      queuePosition = await emitQueuePositionChanged(databaseName, conversation._id, "ENTERED_QUEUE");
    }

    broadcastLiveChatEvent(
      {
        databaseName,
      },
      "NEW_CONVERSATION",
      newConversationResponse,
    );

    emitQueueUpdated(databaseName, "NEW_CONVERSATION", newConversationResponse);

    if (selectedAgent) {
      await createAndBroadcastTenantNotification(databaseName, String(selectedAgent._id), {
        type: "CHATS",
        title: "New chat assigned",
        message: `${normalizeText(visitor?.name, "Visitor")} has been assigned to you.`,
        relatedData: {
          queueEntryId: queueEntry?._id || null,
          conversationId: conversation?._id || null,
          visitorName: normalizeText(visitor?.name) || null,
          visitorEmail: normalizeText(visitor?.emailAddress) || null,
          metadata: {
            reason: "AUTO_ASSIGNED_CONVERSATION",
          },
        },
      });

      const assignedResponse = buildConversationResponse(conversation, queueEntry, visitor, selectedAgent, initialMessage);
      broadcastLiveChatEvent(
        {
          databaseName,
          agentId: String(selectedAgent._id),
          visitorToken,
          conversationId: String(conversation._id),
        },
        "CONVERSATION_ASSIGNED",
        assignedResponse,
      );

      emitQueueUpdated(databaseName, "CONVERSATION_ASSIGNED", assignedResponse);
    } else {
      await notifyStaffAboutWaitingQueue(databaseName, {
        queueEntryId: queueEntry?._id,
        conversationId: conversation?._id,
        visitorName: visitor?.name,
      });
    }

    if (initialMessage) {
      broadcastLiveChatEvent(
        {
          databaseName,
          conversationId: String(conversation._id),
          agentId: selectedAgent ? String(selectedAgent._id) : null,
        },
        "NEW_MESSAGE",
        sanitizeMessage(initialMessage),
      );
    }

    return {
      ...buildConversationResponse(conversation, queueEntry, visitor, selectedAgent, initialMessage),
      queuePosition: queuePosition || null,
    };
  } catch (error) {
    logger.error(`Error starting conversation: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to start conversation: ${error.message}`);
  }
};

const getQueueByStatus = async (payload = {}) => {
  try {
    const { databaseName, page, limit, statuses, agentId } = payload;
    ensureDatabaseName(databaseName);

    const { Queue } = getTenantModels(databaseName);
    const { page: currentPage, limit: currentLimit, skip } = parsePagination(page, limit);
    const normalizedStatuses = normalizeStatusArray(statuses, [QUEUE_STATUS.WAITING]);

    const query = {
      status: {
        $in: normalizedStatuses,
      },
      endedAt: null,
    };

    if (agentId) {
      query.agentId = agentId;
    }

    const conversationStatusFilter = [];
    if (normalizedStatuses.includes(QUEUE_STATUS.WAITING)) {
      conversationStatusFilter.push(CONVERSATION_STATUS.WAITING);
    }
    if (normalizedStatuses.includes(QUEUE_STATUS.ASSIGNED)) {
      conversationStatusFilter.push(CONVERSATION_STATUS.OPEN);
    }

    const [queueEntries, totalCount] = await Promise.all([
      Queue.find(query)
        .populate({
          path: "conversationId",
          match: {
            status: {
              $in: conversationStatusFilter,
            },
          },
        })
        .populate("visitorId")
        .populate("agentId")
        .sort({ queuedAt: 1, createdAt: 1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      Queue.countDocuments(query),
    ]);

    const visibleQueueEntries = queueEntries.filter((entry) => Boolean(entry?.conversationId));

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / currentLimit) : 0;

    return {
      queue: visibleQueueEntries.map(sanitizeQueueEntry),
      pagination: {
        page: currentPage,
        limit: currentLimit,
        totalCount,
        totalPages,
        hasNextPage: totalPages > 0 && currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    };
  } catch (error) {
    logger.error(`Error fetching queue: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch queue: ${error.message}`);
  }
};

const getQueue = async (payload = {}) => {
  return getQueueByStatus({
    ...payload,
    statuses: [QUEUE_STATUS.WAITING],
  });
};

const getActiveConversations = async (payload = {}) => {
  return getQueueByStatus({
    ...payload,
    statuses: [QUEUE_STATUS.ASSIGNED],
  });
};

const getConversationHistory = async (payload = {}) => {
  try {
    const { databaseName, page, limit, agentId } = payload;
    ensureDatabaseName(databaseName);

    const { Conversations } = getTenantModels(databaseName);
    const { page: currentPage, limit: currentLimit, skip } = parsePagination(page, limit);
    const query = {
      status: CONVERSATION_STATUS.ENDED,
    };

    if (agentId) {
      query.agentId = agentId;
    }

    const [conversations, totalCount] = await Promise.all([
      Conversations.find(query)
        .populate("visitorId")
        .populate("agentId")
        .sort({ closedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      Conversations.countDocuments(query),
    ]);

    const feedbackMap = await getConversationFeedbackMap(databaseName, conversations.map((conversation) => conversation?._id));

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / currentLimit) : 0;

    return {
      conversations: conversations.map((conversation) => {
        const sanitizedConversation = sanitizeConversation(conversation);
        const feedback = feedbackMap.get(String(sanitizedConversation?._id || "")) || null;

        return {
          ...sanitizedConversation,
          rating: feedback?.rating ?? null,
          ratingComment: feedback?.comment ?? null,
          ratedAt: feedback?.createdAt || null,
        };
      }),
      pagination: {
        page: currentPage,
        limit: currentLimit,
        totalCount,
        totalPages,
        hasNextPage: totalPages > 0 && currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    };
  } catch (error) {
    logger.error(`Error fetching conversation history: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch conversation history: ${error.message}`);
  }
};

const getVisitors = async (payload = {}) => {
  try {
    const { databaseName, page, limit, search } = payload;
    ensureDatabaseName(databaseName);

    const { Visitors, Conversations } = getTenantModels(databaseName);
    const { page: currentPage, limit: currentLimit, skip } = parsePagination(page, limit);
    const normalizedSearch = normalizeText(search).toLowerCase();

    const query = {};
    if (normalizedSearch) {
      query.$or = [
        { name: { $regex: normalizedSearch, $options: "i" } },
        { emailAddress: { $regex: normalizedSearch, $options: "i" } },
        { visitorToken: { $regex: normalizedSearch, $options: "i" } },
        { locationCity: { $regex: normalizedSearch, $options: "i" } },
        { locationCountry: { $regex: normalizedSearch, $options: "i" } },
      ];
    }

    const [visitors, totalCount] = await Promise.all([
      Visitors.find(query)
        .sort({ lastSeenAt: -1, updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      Visitors.countDocuments(query),
    ]);

    const visitorIds = visitors.map((visitor) => visitor?._id).filter(Boolean);

    const conversationStats = visitorIds.length > 0
      ? await Conversations.aggregate([
        {
          $match: {
            visitorId: {
              $in: visitorIds,
            },
          },
        },
        {
          $group: {
            _id: "$visitorId",
            conversationCount: { $sum: 1 },
            lastConversationAt: { $max: "$updatedAt" },
          },
        },
      ])
      : [];

    const statsByVisitorId = new Map(
      conversationStats.map((entry) => [
        String(entry?._id || ""),
        {
          conversationCount: Number(entry?.conversationCount || 0),
          lastConversationAt: entry?.lastConversationAt || null,
        },
      ]),
    );

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / currentLimit) : 0;

    return {
      visitors: visitors.map((visitor) => {
        const sanitizedVisitor = sanitizeVisitor(visitor);
        const normalizedId = String(sanitizedVisitor?._id || "");
        const stats = statsByVisitorId.get(normalizedId) || {
          conversationCount: 0,
          lastConversationAt: null,
        };

        return {
          ...sanitizedVisitor,
          displayName: buildVisitorDisplayName(sanitizedVisitor),
          conversationCount: stats.conversationCount,
          lastConversationAt: stats.lastConversationAt,
        };
      }),
      pagination: {
        page: currentPage,
        limit: currentLimit,
        totalCount,
        totalPages,
        hasNextPage: totalPages > 0 && currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    };
  } catch (error) {
    logger.error(`Error fetching visitors: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch visitors: ${error.message}`);
  }
};

const getVisitorById = async (payload = {}) => {
  try {
    const { databaseName, visitorId, page, limit } = payload;
    ensureDatabaseName(databaseName);

    const normalizedVisitorId = normalizeText(visitorId);
    if (!normalizedVisitorId) {
      throw new BadRequestError("visitorId is required.");
    }

    const { Visitors, Conversations, Messages } = getTenantModels(databaseName);
    const { page: currentPage, limit: currentLimit, skip } = parsePagination(page, limit);

    const visitor = await Visitors.findById(normalizedVisitorId).lean();

    if (!visitor) {
      throw new NotFoundError("Visitor not found.");
    }

    const [conversations, totalCount] = await Promise.all([
      Conversations.find({ visitorId: normalizedVisitorId })
        .populate("agentId")
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      Conversations.countDocuments({ visitorId: normalizedVisitorId }),
    ]);

    const conversationIds = conversations.map((conversation) => conversation?._id).filter(Boolean);

    const messageStats = conversationIds.length > 0
      ? await Messages.aggregate([
        {
          $match: {
            conversationId: {
              $in: conversationIds,
            },
          },
        },
        {
          $sort: {
            createdAt: 1,
          },
        },
        {
          $group: {
            _id: "$conversationId",
            messageCount: { $sum: 1 },
            firstMessage: { $first: "$message" },
            lastMessage: { $last: "$message" },
            lastMessageAt: { $last: "$createdAt" },
          },
        },
      ])
      : [];

    const messageStatsByConversationId = new Map(
      messageStats.map((entry) => [
        String(entry?._id || ""),
        {
          messageCount: Number(entry?.messageCount || 0),
          firstMessage: normalizeText(entry?.firstMessage),
          lastMessage: normalizeText(entry?.lastMessage),
          lastMessageAt: entry?.lastMessageAt || null,
        },
      ]),
    );

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / currentLimit) : 0;

    return {
      visitor: {
        ...sanitizeVisitor(visitor),
        displayName: buildVisitorDisplayName(visitor),
      },
      conversations: conversations.map((conversation) => {
        const sanitizedConversation = sanitizeConversation(conversation);
        const stats = messageStatsByConversationId.get(String(sanitizedConversation?._id || "")) || {
          messageCount: 0,
          firstMessage: "",
          lastMessage: "",
          lastMessageAt: null,
        };

        return {
          ...sanitizedConversation,
          history: stats,
        };
      }),
      pagination: {
        page: currentPage,
        limit: currentLimit,
        totalCount,
        totalPages,
        hasNextPage: totalPages > 0 && currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    };
  } catch (error) {
    logger.error(`Error fetching visitor details: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch visitor details: ${error.message}`);
  }
};

const getWidgetConversationHistory = async (payload = {}, req = {}) => {
  try {
    const { databaseName, page, limit } = payload;
    ensureDatabaseName(databaseName);

    const requestVisitorToken = resolveVisitorToken(req, payload);

    if (!requestVisitorToken) {
      throw new BadRequestError("visitorToken is required.");
    }

    const { Conversations, Visitors } = getTenantModels(databaseName);
    const { page: currentPage, limit: currentLimit, skip } = parsePagination(page, limit);

    const query = {
      status: CONVERSATION_STATUS.ENDED,
      visitorToken: requestVisitorToken,
    };

    const [visitor, conversations, totalCount] = await Promise.all([
      Visitors.findOne({ visitorToken: requestVisitorToken }).lean(),
      Conversations.find(query)
        .populate("visitorId")
        .populate("agentId")
        .sort({ closedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      Conversations.countDocuments(query),
    ]);

    const feedbackMap = await getConversationFeedbackMap(databaseName, conversations.map((conversation) => conversation?._id));

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / currentLimit) : 0;

    return {
      conversations: conversations.map((conversation) => {
        const sanitizedConversation = sanitizeConversation(conversation);
        const feedback = feedbackMap.get(String(sanitizedConversation?._id || "")) || null;

        return {
          ...sanitizedConversation,
          rating: feedback?.rating ?? null,
          ratingComment: feedback?.comment ?? null,
          ratedAt: feedback?.createdAt || null,
        };
      }),
      pagination: {
        page: currentPage,
        limit: currentLimit,
        totalCount,
        totalPages,
        hasNextPage: totalPages > 0 && currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
      historyCount: totalCount,
      isReturningVisitor: Boolean(visitor),
      visitor: sanitizeVisitor(visitor),
    };
  } catch (error) {
    logger.error(`Error fetching widget conversation history: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch widget conversation history: ${error.message}`);
  }
};

const getWidgetVisitorProfile = async (payload = {}, req = {}) => {
  try {
    const { databaseName } = payload;
    ensureDatabaseName(databaseName);

    const visitorToken = resolveVisitorToken(req, payload);

    if (!visitorToken) {
      throw new BadRequestError("visitorToken is required.");
    }

    const { Visitors } = getTenantModels(databaseName);
    let visitor = await Visitors.findOne({ visitorToken }).lean();

    if (!visitor) {
      const [createdVisitor] = await Visitors.create([
        {
          visitorToken,
          lastSeenAt: new Date(),
        },
      ]);

      visitor = safeObject(createdVisitor);
    }

    return {
      visitor: sanitizeVisitor(visitor),
    };
  } catch (error) {
    logger.error(`Error fetching widget visitor profile: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch widget visitor profile: ${error.message}`);
  }
};

const updateWidgetVisitorProfile = async (payload = {}, req = {}) => {
  try {
    const { databaseName } = payload;
    ensureDatabaseName(databaseName);

    const visitorToken = resolveVisitorToken(req, payload);

    if (!visitorToken) {
      throw new BadRequestError("visitorToken is required.");
    }

    const { Visitors } = getTenantModels(databaseName);
    let visitor = await Visitors.findOne({ visitorToken });

    if (!visitor) {
      const [createdVisitor] = await Visitors.create([
        {
          visitorToken,
          lastSeenAt: new Date(),
        },
      ]);

      visitor = createdVisitor;
    }

    const nextName = normalizeText(payload.fullName || payload.name);
    const nextEmail = normalizeText(payload.emailAddress).toLowerCase();
    const nextPhone = normalizeText(payload.phoneNumber);

    if (Object.prototype.hasOwnProperty.call(payload, "fullName") || Object.prototype.hasOwnProperty.call(payload, "name")) {
      visitor.name = nextName || undefined;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "emailAddress")) {
      visitor.emailAddress = nextEmail || undefined;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "phoneNumber")) {
      visitor.phoneNumber = nextPhone || null;
    }

    visitor.lastSeenAt = new Date();
    await visitor.save();

    return {
      visitor: sanitizeVisitor(visitor),
    };
  } catch (error) {
    logger.error(`Error updating widget visitor profile: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to update widget visitor profile: ${error.message}`);
  }
};

const assignWaitingConversationToAgent = async ({ databaseName, conversationId, claimedAgent }) => {
  const { Conversations, Queue } = getTenantModels(databaseName);
  const now = new Date();
  const waitingQueueSnapshot = await Queue.findOne({
    conversationId,
    status: QUEUE_STATUS.WAITING,
    endedAt: null,
  })
    .select({ queuedAt: 1 })
    .lean();

  const updatedConversation = await Conversations.findOneAndUpdate(
    { _id: conversationId, status: CONVERSATION_STATUS.WAITING, agentId: null },
    {
      agentId: claimedAgent._id,
      status: CONVERSATION_STATUS.OPEN,
      assignedAt: now,
    },
    { new: true, runValidators: true },
  )
    .populate("visitorId")
    .populate("agentId")
    .lean();

  if (!updatedConversation) {
    throw new ForbiddenError("Conversation is no longer waiting.");
  }

  const updatedQueue = await Queue.findOneAndUpdate(
    { conversationId, status: QUEUE_STATUS.WAITING },
    {
      agentId: claimedAgent._id,
      status: QUEUE_STATUS.ASSIGNED,
      assignedAt: now,
    },
    { new: true, runValidators: true },
  ).lean();

  await syncAgentAvailability(databaseName, claimedAgent._id);

  const assignedResponse = buildConversationResponse(updatedConversation, updatedQueue, updatedConversation.visitorId, claimedAgent);

  broadcastLiveChatEvent(
    {
      databaseName,
      agentId: String(claimedAgent._id),
      visitorToken: normalizeText(updatedConversation?.visitorToken),
      conversationId: String(updatedConversation?._id || conversationId),
    },
    "CONVERSATION_ASSIGNED",
    assignedResponse,
  );

  emitQueueUpdated(databaseName, "CONVERSATION_ASSIGNED", assignedResponse);
  await notifyWaitingVisitorsAfterQueueRemoval(databaseName, waitingQueueSnapshot?.queuedAt, "MOVED_UP");

  await createAndBroadcastTenantNotification(databaseName, String(claimedAgent._id), {
    type: "CHATS",
    title: "Conversation assigned",
    message: `${normalizeText(updatedConversation?.visitorId?.name, "Visitor")} has been assigned to you.`,
    relatedData: {
      queueEntryId: updatedQueue?._id || null,
      conversationId: updatedConversation?._id || null,
      visitorName: normalizeText(updatedConversation?.visitorId?.name) || null,
      visitorEmail: normalizeText(updatedConversation?.visitorId?.emailAddress) || null,
      metadata: {
        reason: "MANUAL_ASSIGNMENT",
      },
    },
  });

  return assignedResponse;
};

const assignConversation = async (payload = {}, req = {}) => {
  try {
    const { databaseName, conversationId, agentId } = payload;
    ensureDatabaseName(databaseName);

    if (!isAdminOrMasterRole(req.agent?.role)) {
      throw new ForbiddenError("Only admins can assign a conversation.");
    }

    if (!conversationId) {
      throw new BadRequestError("conversationId is required.");
    }

    if (!agentId) {
      throw new BadRequestError("agentId is required.");
    }

    const { conversation, queueEntry } = await getConversationOrFail(databaseName, conversationId);

    if (!conversation || conversation.status !== CONVERSATION_STATUS.WAITING) {
      throw new ForbiddenError("Conversation is not waiting for assignment.");
    }

    if (!queueEntry || queueEntry.status !== QUEUE_STATUS.WAITING) {
      throw new ForbiddenError("Queue entry is not available for assignment.");
    }

    const claimedAgent = await claimAgent(databaseName, agentId);

    if (!claimedAgent) {
      throw new ForbiddenError("Selected agent is not available.");
    }

    try {
      return await assignWaitingConversationToAgent({
        databaseName,
        conversationId,
        claimedAgent,
      });
    } catch (error) {
      await releaseAgent(databaseName, claimedAgent._id);
      throw error;
    }
  } catch (error) {
    logger.error(`Error assigning conversation: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to assign conversation: ${error.message}`);
  }
};

const acceptConversation = async (payload = {}, req = {}) => {
  try {
    const { databaseName, conversationId } = payload;
    ensureDatabaseName(databaseName);

    const agentId = String(req.agent?._id || "").trim();
    const actorRole = String(req.agent?.role || "").trim().toUpperCase();

    if (!conversationId) {
      throw new BadRequestError("conversationId is required.");
    }

    if (!agentId) {
      throw new ForbiddenError("Authenticated agent is required.");
    }

    if (![USER_ROLES.MASTER_ADMIN.value, USER_ROLES.ADMIN.value, USER_ROLES.SUPPORT_AGENT.value].includes(actorRole)) {
      throw new ForbiddenError("Only chat staff can take a conversation.");
    }

    const { conversation, queueEntry } = await getConversationOrFail(databaseName, conversationId);

    if (!conversation || conversation.status !== CONVERSATION_STATUS.WAITING) {
      throw new ForbiddenError("Conversation is no longer waiting.");
    }

    if (!queueEntry || queueEntry.status !== QUEUE_STATUS.WAITING || queueEntry.endedAt) {
      throw new ForbiddenError("Queue entry is no longer waiting.");
    }

    const claimedAgent = await claimAgent(databaseName, agentId);

    if (actorRole === USER_ROLES.SUPPORT_AGENT.value) {
      if (String(claimedAgent.status || "").toUpperCase() !== USER_STATUS.AVAILABLE) {
        throw new ForbiddenError("Support agent can self-pick only while AVAILABLE.");
      }
    }

    try {
      return await assignWaitingConversationToAgent({
        databaseName,
        conversationId,
        claimedAgent,
      });
    } catch (error) {
      await releaseAgent(databaseName, claimedAgent._id);
      throw error;
    }
  } catch (error) {
    logger.error(`Error accepting conversation: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to accept conversation: ${error.message}`);
  }
};

const transferConversation = async (payload = {}, req = {}) => {
  try {
    const { databaseName, conversationId, agentId } = payload;
    ensureDatabaseName(databaseName);

    if (!conversationId) {
      throw new BadRequestError("conversationId is required.");
    }

    if (!agentId) {
      throw new BadRequestError("agentId is required.");
    }

    if (!isAdminOrMasterRole(req.agent?.role)) {
      throw new ForbiddenError("Only admins can transfer an active conversation.");
    }

    const { conversation, queueEntry } = await getConversationOrFail(databaseName, conversationId);

    if (conversation.status !== CONVERSATION_STATUS.OPEN) {
      throw new ForbiddenError("Conversation must be OPEN to transfer.");
    }

    const currentAgentId = String(conversation.agentId?._id || conversation.agentId || "").trim();
    const nextAgentId = String(agentId).trim();

    if (!nextAgentId) {
      throw new BadRequestError("agentId is required.");
    }

    if (currentAgentId && currentAgentId === nextAgentId) {
      return buildConversationResponse(conversation, queueEntry, conversation.visitorId, conversation.agentId);
    }

    const claimedAgent = await claimAgent(databaseName, nextAgentId);

    if (!claimedAgent) {
      throw new ForbiddenError("Selected agent is not available.");
    }

    const now = new Date();
    const { Conversations, Queue } = getTenantModels(databaseName);

    try {
      const updatedConversation = await Conversations.findOneAndUpdate(
        { _id: conversationId, status: CONVERSATION_STATUS.OPEN },
        {
          agentId: claimedAgent._id,
          assignedAt: now,
        },
        { new: true, runValidators: true },
      )
        .populate("visitorId")
        .populate("agentId")
        .lean();

      if (!updatedConversation) {
        throw new ForbiddenError("Conversation is no longer open.");
      }

      const updatedQueue = await Queue.findOneAndUpdate(
        { conversationId },
        {
          agentId: claimedAgent._id,
          status: QUEUE_STATUS.ASSIGNED,
          assignedAt: now,
        },
        { new: true, runValidators: true },
      ).lean();

      await syncAgentAvailability(databaseName, claimedAgent._id);

      if (currentAgentId && currentAgentId !== nextAgentId) {
        await releaseAgent(databaseName, currentAgentId);
      }

      const response = buildConversationResponse(updatedConversation, updatedQueue, updatedConversation.visitorId, claimedAgent);

      broadcastLiveChatEvent(
        {
          databaseName,
          conversationId: String(conversationId),
        },
        "CONVERSATION_TRANSFERRED",
        response,
      );

      emitQueueUpdated(databaseName, "CONVERSATION_TRANSFERRED", response);

      return response;
    } catch (error) {
      await releaseAgent(databaseName, claimedAgent._id);
      throw error;
    }
  } catch (error) {
    logger.error(`Error transferring conversation: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to transfer conversation: ${error.message}`);
  }
};

const endConversation = async (payload = {}, req = {}) => {
  try {
    const { databaseName, conversationId } = payload;
    ensureDatabaseName(databaseName);

    if (!conversationId) {
      throw new BadRequestError("conversationId is required.");
    }

    const { conversation, queueEntry } = await getConversationOrFail(databaseName, conversationId);
    const endedWaitingQueuedAt = conversation?.status === CONVERSATION_STATUS.WAITING
      ? queueEntry?.queuedAt
      : null;
    const actorRole = normalizeText(req.agent?.role).toUpperCase();
    const actorId = String(req.agent?._id || "").trim();

    if (req.agent) {
      const isAdminActor = [USER_ROLES.ADMIN.value, USER_ROLES.MASTER_ADMIN.value].includes(actorRole);
      const isAssignedAgent = String(conversation.agentId?._id || conversation.agentId || "").trim() === actorId;

      if (!isAdminActor && !isAssignedAgent) {
        throw new ForbiddenError("Only the assigned agent or an admin can end this conversation.");
      }
    } else {
      const requestVisitorToken = resolveVisitorToken(req, payload);
      const { Visitors } = getTenantModels(databaseName);
      const visitor = conversation.visitorId
        ? await Visitors.findById(conversation.visitorId).lean()
        : null;

      assertVisitorConversationAccess({
        conversation,
        requestVisitorToken,
        visitor,
      });
    }

    if (conversation.status === CONVERSATION_STATUS.ENDED) {
      return buildConversationResponse(conversation, queueEntry, conversation.visitorId, conversation.agentId);
    }

    const now = new Date();
    const { Conversations, Queue } = getTenantModels(databaseName);

    const updatedConversation = await Conversations.findOneAndUpdate(
      { _id: conversationId },
      {
        status: CONVERSATION_STATUS.ENDED,
        closedAt: now,
        closedByRole: req.agent ? actorRole : USER_ROLES.VISITOR.value,
        closedById: req.agent ? req.agent._id : conversation.visitorId,
      },
      { new: true, runValidators: true },
    )
      .populate("visitorId")
      .populate("agentId")
      .lean();

    const updatedQueue = await Queue.findOneAndUpdate(
      { conversationId },
      {
        endedAt: now,
        closedByRole: req.agent ? actorRole : USER_ROLES.VISITOR.value,
        closedById: req.agent ? req.agent._id : conversation.visitorId,
      },
      { new: true, runValidators: true },
    ).lean();

    if (conversation.agentId) {
      await releaseAgent(databaseName, conversation.agentId._id || conversation.agentId);
    }

    const response = buildConversationResponse(updatedConversation, updatedQueue || queueEntry, updatedConversation.visitorId, updatedConversation.agentId);
    const endedBy = buildEndedByMetadata(response);

    broadcastLiveChatEvent(
      {
        databaseName,
        conversationId: String(conversationId),
      },
      "CONVERSATION_ENDED",
      {
        ...response,
        endedBy,
      },
    );

    emitQueueUpdated(databaseName, "CONVERSATION_ENDED", response);
    await notifyWaitingVisitorsAfterQueueRemoval(databaseName, endedWaitingQueuedAt, "MOVED_UP");

    // Notify staff when a visitor ends the chat so they can react outside the chat page.
    if (!req.agent) {
      const recipientAgentIds = await resolveVisitorMessageNotificationRecipients(databaseName, conversation);

      if (recipientAgentIds.length > 0) {
        await Promise.all(
          recipientAgentIds.map((agentId) => createAndBroadcastTenantNotification(databaseName, agentId, {
            type: "CHATS",
            title: "Chat ended by visitor",
            message: "The visitor has ended the chat.",
            relatedData: {
              conversationId: String(conversationId),
              metadata: {
                reason: "VISITOR_ENDED_CHAT",
              },
            },
          })),
        );
      }
    }

    return response;
  } catch (error) {
    logger.error(`Error ending conversation: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to end conversation: ${error.message}`);
  }
};

const sendMessage = async (payload = {}, req = {}) => {
  try {
    const { databaseName, conversationId, message, senderType } = payload;
    ensureDatabaseName(databaseName);

    if (!conversationId) {
      throw new BadRequestError("conversationId is required.");
    }

    const normalizedMessage = normalizeText(message);
    if (!normalizedMessage) {
      throw new BadRequestError("message is required.");
    }

    const { Conversations, Messages, Visitors } = getTenantModels(databaseName);
    const conversation = await Conversations.findById(conversationId).lean();

    if (!conversation) {
      throw new NotFoundError("Conversation not found.");
    }

    const normalizedSenderType = normalizeText(senderType || req.agent?.role || USER_ROLES.VISITOR.value).toUpperCase();
    const isVisitorMessage = normalizedSenderType === USER_ROLES.VISITOR.value;
    const isAgentMessage = [USER_ROLES.ADMIN.value, USER_ROLES.SUPPORT_AGENT.value, USER_ROLES.MASTER_ADMIN.value].includes(normalizedSenderType);

    if (!isVisitorMessage && !isAgentMessage) {
      throw new BadRequestError("senderType must be VISITOR, ADMIN, SUPPORT_AGENT, or MASTER_ADMIN.");
    }

    let senderId = null;

    if (isVisitorMessage) {
      const requestVisitorToken = resolveVisitorToken(req, payload);

      // Fast path: validate token against conversation directly without extra DB query
      const conversationVisitorToken = normalizeText(conversation?.visitorToken);
      if (conversationVisitorToken && conversationVisitorToken !== requestVisitorToken) {
        throw new ForbiddenError("Conversation access denied for this visitor token.");
      }

      // Use conversation's visitor ID directly (already validated when conversation was created)
      senderId = conversation.visitorId ? String(conversation.visitorId) : null;

      if (!senderId) {
        throw new NotFoundError("Visitor not found for this conversation.");
      }
    } else {
      senderId = req.agent?._id || payload.senderId || null;

      if (!senderId) {
        throw new ForbiddenError("Authenticated agent is required to send agent messages.");
      }
    }

    const [createdMessage] = await Messages.create([
      {
        conversationId,
        senderType: normalizedSenderType,
        senderId,
        message: normalizedMessage,
        status: MESSAGE_STATUS.DELIVERED,
      },
    ]);

    const sanitizedCreatedMessage = sanitizeMessage(createdMessage);
    const normalizedConversationId = String(conversationId);
    const normalizedAgentId = conversation.agentId ? String(conversation.agentId) : "";

    // Broadcast events non-blocking (fire and forget) for real-time delivery
    broadcastLiveChatEvent(
      {
        databaseName,
        conversationId: normalizedConversationId,
      },
      "NEW_MESSAGE",
      sanitizedCreatedMessage,
    );

    if (normalizedAgentId) {
      broadcastLiveChatEvent(
        {
          databaseName,
          agentId: normalizedAgentId,
        },
        "NEW_MESSAGE",
        sanitizedCreatedMessage,
      );
    }

    if (isVisitorMessage) {
      const recipientAgentIds = await resolveVisitorMessageNotificationRecipients(databaseName, conversation);

      await Promise.all(
        recipientAgentIds.map((agentId) => createAndBroadcastTenantNotification(databaseName, agentId, {
          type: "CHATS",
          title: "New message from visitor",
          message: normalizedMessage,
          relatedData: {
            conversationId: conversationId,
            visitorName: null,
            metadata: {
              reason: "VISITOR_MESSAGE",
              senderType: normalizedSenderType,
            },
          },
        })),
      );
    }

    return sanitizeMessage(createdMessage);
  } catch (error) {
    logger.error(`Error sending message: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to send message: ${error.message}`);
  }
};

const getMessagesByConversationId = async (payload = {}, req = {}) => {
  try {
    const { databaseName, conversationId, page, limit } = payload;
    ensureDatabaseName(databaseName);

    if (!conversationId) {
      throw new BadRequestError("conversationId is required.");
    }

    const { Conversations, Messages, Visitors } = getTenantModels(databaseName);
    const { page: currentPage, limit: currentLimit, skip } = parsePagination(page, limit);

    const conversation = await Conversations.findById(conversationId).lean();

    if (!conversation) {
      throw new NotFoundError("Conversation not found.");
    }

    const isStaffReader = Boolean(req.agent);

    if (!isStaffReader) {
      const requestVisitorToken = resolveVisitorToken(req, payload);
      const visitor = conversation.visitorId
        ? await Visitors.findById(conversation.visitorId).lean()
        : null;

      assertVisitorConversationAccess({
        conversation,
        requestVisitorToken,
        visitor,
      });

      const seenAt = new Date();
      const seenFilter = {
        conversationId,
        senderType: { $ne: USER_ROLES.VISITOR.value },
        status: { $ne: MESSAGE_STATUS.SEEN },
      };

      const pendingAgentMessages = await Messages.find(seenFilter).select("_id").lean();

      if (pendingAgentMessages.length > 0) {
        await Messages.updateMany(
          seenFilter,
          {
            status: MESSAGE_STATUS.SEEN,
            seenAt,
            seenById: visitor?._id || null,
            seenByRole: USER_ROLES.VISITOR.value,
          },
        );

        const statusPayload = {
          conversationId: String(conversationId),
          status: MESSAGE_STATUS.SEEN,
          messageIds: pendingAgentMessages.map((entry) => String(entry._id)),
          seenAt: seenAt.toISOString(),
          seenByRole: USER_ROLES.VISITOR.value,
        };

        const normalizedVisitorToken = normalizeText(conversation.visitorToken);
        const normalizedAgentId = conversation.agentId ? String(conversation.agentId) : "";

        broadcastLiveChatEvent(
          {
            databaseName,
            conversationId: String(conversationId),
            visitorToken: normalizedVisitorToken,
          },
          "MESSAGE_STATUS_UPDATED",
          statusPayload,
        );

        if (normalizedAgentId) {
          broadcastLiveChatEvent(
            {
              databaseName,
              agentId: normalizedAgentId,
            },
            "MESSAGE_STATUS_UPDATED",
            statusPayload,
          );
        }
      }
    } else {
      const actorRole = normalizeText(req.agent?.role).toUpperCase();
      const actorId = String(req.agent?._id || "").trim();
      const isAdminActor = [USER_ROLES.ADMIN.value, USER_ROLES.MASTER_ADMIN.value].includes(actorRole);
      const isSupportAgentActor = actorRole === USER_ROLES.SUPPORT_AGENT.value;
      const isAssignedAgent = String(conversation.agentId || "") === actorId;
      const isWaitingConversation = String(conversation.status || "").toUpperCase() === CONVERSATION_STATUS.WAITING;

      // Support agents may inspect waiting conversations before they self-pick.
      const canSupportAgentInspectWaitingConversation = isSupportAgentActor && isWaitingConversation;

      if (!isAdminActor && !isAssignedAgent && !canSupportAgentInspectWaitingConversation) {
        throw new ForbiddenError("You do not have access to this conversation.");
      }

      const seenAt = new Date();
      const seenFilter = {
        conversationId,
        senderType: USER_ROLES.VISITOR.value,
        status: { $ne: MESSAGE_STATUS.SEEN },
      };

      const pendingVisitorMessages = await Messages.find(seenFilter).select("_id").lean();

      if (pendingVisitorMessages.length > 0) {
        await Messages.updateMany(
          seenFilter,
          {
            status: MESSAGE_STATUS.SEEN,
            seenAt,
            seenById: req.agent._id,
            seenByRole: actorRole,
          },
        );

        const statusPayload = {
          conversationId: String(conversationId),
          status: MESSAGE_STATUS.SEEN,
          messageIds: pendingVisitorMessages.map((entry) => String(entry._id)),
          seenAt: seenAt.toISOString(),
          seenByRole: actorRole,
        };

        const normalizedVisitorToken = normalizeText(conversation.visitorToken);
        const normalizedAgentId = conversation.agentId ? String(conversation.agentId) : "";

        broadcastLiveChatEvent(
          {
            databaseName,
            conversationId: String(conversationId),
            visitorToken: normalizedVisitorToken,
          },
          "MESSAGE_STATUS_UPDATED",
          statusPayload,
        );

        if (normalizedAgentId) {
          broadcastLiveChatEvent(
            {
              databaseName,
              agentId: normalizedAgentId,
            },
            "MESSAGE_STATUS_UPDATED",
            statusPayload,
          );
        }
      }
    }

    const query = { conversationId };

    const [messages, totalCount] = await Promise.all([
      Messages.find(query)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      Messages.countDocuments(query),
    ]);

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / currentLimit) : 0;

    return {
      messages: messages.map(sanitizeMessage),
      pagination: {
        page: currentPage,
        limit: currentLimit,
        totalCount,
        totalPages,
        hasNextPage: totalPages > 0 && currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    };
  } catch (error) {
    logger.error(`Error fetching messages: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch messages: ${error.message}`);
  }
};

const getAnalyticsSummary = async (payload = {}) => {
  try {
    const { databaseName, days } = payload;
    ensureDatabaseName(databaseName);

    const parsedDays = Number.parseInt(String(days || 7), 10);
    const periodDays = Number.isFinite(parsedDays)
      ? Math.min(90, Math.max(1, parsedDays))
      : 7;

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (periodDays - 1));
    startDate.setHours(0, 0, 0, 0);

    const previousEndDate = new Date(startDate.getTime() - 1);
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousStartDate.getDate() - (periodDays - 1));
    previousStartDate.setHours(0, 0, 0, 0);

    const currentRange = {
      $gte: startDate,
      $lte: endDate,
    };
    const previousRange = {
      $gte: previousStartDate,
      $lte: previousEndDate,
    };

    const { Conversations, Messages, Queue, Agents } = getTenantModels(databaseName);

    const [
      totalChats,
      previousTotalChats,
      totalMessages,
      previousTotalMessages,
      distinctVisitors,
      previousDistinctVisitors,
      avgResponseAgg,
      previousAvgResponseAgg,
      avgResolutionAgg,
      volumeAgg,
      agentAgg,
      segmentationAgg,
      missedChats,
      slowResponses,
      conversionAgg,
      visitorLocationAgg,
      keywordMessages,
    ] = await Promise.all([
      Conversations.countDocuments({ createdAt: currentRange }),
      Conversations.countDocuments({ createdAt: previousRange }),
      Messages.countDocuments({ createdAt: currentRange }),
      Messages.countDocuments({ createdAt: previousRange }),
      Conversations.distinct("visitorId", { createdAt: currentRange }).then((ids) => ids.length),
      Conversations.distinct("visitorId", { createdAt: previousRange }).then((ids) => ids.length),
      Conversations.aggregate([
        {
          $match: {
            createdAt: currentRange,
            assignedAt: { $ne: null },
            queuedAt: { $ne: null },
          },
        },
        {
          $project: {
            responseMs: { $subtract: ["$assignedAt", "$queuedAt"] },
          },
        },
        {
          $match: {
            responseMs: { $gte: 0 },
          },
        },
        {
          $group: {
            _id: null,
            value: { $avg: "$responseMs" },
          },
        },
      ]),
      Conversations.aggregate([
        {
          $match: {
            createdAt: previousRange,
            assignedAt: { $ne: null },
            queuedAt: { $ne: null },
          },
        },
        {
          $project: {
            responseMs: { $subtract: ["$assignedAt", "$queuedAt"] },
          },
        },
        {
          $match: {
            responseMs: { $gte: 0 },
          },
        },
        {
          $group: {
            _id: null,
            value: { $avg: "$responseMs" },
          },
        },
      ]),
      Conversations.aggregate([
        {
          $match: {
            status: CONVERSATION_STATUS.ENDED,
            closedAt: currentRange,
            queuedAt: { $ne: null },
          },
        },
        {
          $project: {
            resolutionMs: { $subtract: ["$closedAt", "$queuedAt"] },
          },
        },
        {
          $match: {
            resolutionMs: { $gte: 0 },
          },
        },
        {
          $group: {
            _id: null,
            value: { $avg: "$resolutionMs" },
          },
        },
      ]),
      Conversations.aggregate([
        {
          $match: {
            createdAt: currentRange,
          },
        },
        {
          $project: {
            dayKey: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            resolvedInRange: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", CONVERSATION_STATUS.ENDED] },
                    { $ne: ["$closedAt", null] },
                    { $gte: ["$closedAt", startDate] },
                    { $lte: ["$closedAt", endDate] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
        {
          $group: {
            _id: "$dayKey",
            totalChats: { $sum: 1 },
            resolvedChats: { $sum: "$resolvedInRange" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
      Conversations.aggregate([
        {
          $match: {
            status: CONVERSATION_STATUS.ENDED,
            closedAt: currentRange,
            agentId: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$agentId",
            resolvedChats: { $sum: 1 },
            avgFirstResponseMs: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$assignedAt", null] },
                      { $ne: ["$queuedAt", null] },
                    ],
                  },
                  { $subtract: ["$assignedAt", "$queuedAt"] },
                  null,
                ],
              },
            },
            avgResolutionMs: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$closedAt", null] },
                      { $ne: ["$queuedAt", null] },
                    ],
                  },
                  { $subtract: ["$closedAt", "$queuedAt"] },
                  null,
                ],
              },
            },
          },
        },
        {
          $sort: { resolvedChats: -1 },
        },
        {
          $limit: 8,
        },
      ]),
      Conversations.aggregate([
        {
          $group: {
            _id: "$visitorId",
            firstChatAt: { $min: "$createdAt" },
            chatsInPeriod: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$createdAt", startDate] },
                      { $lte: ["$createdAt", endDate] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $match: {
            chatsInPeriod: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            newUsers: {
              $sum: {
                $cond: [{ $gte: ["$firstChatAt", startDate] }, 1, 0],
              },
            },
            returningUsers: {
              $sum: {
                $cond: [{ $lt: ["$firstChatAt", startDate] }, 1, 0],
              },
            },
          },
        },
      ]),
      Queue.countDocuments({
        status: QUEUE_STATUS.WAITING,
        endedAt: null,
        queuedAt: {
          $lte: new Date(Date.now() - 5 * 60 * 1000),
        },
      }),
      Conversations.countDocuments({
        createdAt: currentRange,
        assignedAt: { $ne: null },
        queuedAt: { $ne: null },
        $expr: {
          $gt: [{ $subtract: ["$assignedAt", "$queuedAt"] }, 2 * 60 * 1000],
        },
      }),
      Conversations.aggregate([
        {
          $match: {
            createdAt: currentRange,
          },
        },
        {
          $lookup: {
            from: "visitors",
            localField: "visitorId",
            foreignField: "_id",
            as: "visitor",
          },
        },
        {
          $unwind: {
            path: "$visitor",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: null,
            totalChats: { $sum: 1 },
            leadChats: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      {
                        $gt: [
                          {
                            $strLenCP: {
                              $ifNull: ["$visitor.emailAddress", ""],
                            },
                          },
                          0,
                        ],
                      },
                      {
                        $gt: [
                          {
                            $strLenCP: {
                              $ifNull: ["$visitor.phoneNumber", ""],
                            },
                          },
                          0,
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Conversations.aggregate([
        {
          $match: {
            createdAt: currentRange,
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $lookup: {
            from: "visitors",
            localField: "visitorId",
            foreignField: "_id",
            as: "visitor",
          },
        },
        {
          $unwind: {
            path: "$visitor",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: "$visitorId",
            locationCity: {
              $first: {
                $ifNull: ["$visitor.locationCity", "$locationCity"],
              },
            },
            locationCountry: {
              $first: {
                $ifNull: ["$visitor.locationCountry", "$locationCountry"],
              },
            },
            locationSource: {
              $first: {
                $ifNull: ["$visitor.locationSource", "$locationSource"],
              },
            },
          },
        },
      ]),
      Messages.find({
        createdAt: currentRange,
        senderType: USER_ROLES.VISITOR.value,
      })
        .sort({ createdAt: -1 })
        .limit(2000)
        .select({ message: 1 })
        .lean(),
    ]);

    const toSeconds = (milliseconds) => {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
        return null;
      }

      return Math.round(milliseconds / 1000);
    };

    const toPercentChange = (currentValue, previousValue) => {
      if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
        return 0;
      }

      if (previousValue <= 0) {
        return currentValue > 0 ? 100 : 0;
      }

      return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
    };

    const avgResponseMs = Number(avgResponseAgg?.[0]?.value || 0);
    const previousAvgResponseMs = Number(previousAvgResponseAgg?.[0]?.value || 0);
    const avgResolutionMs = Number(avgResolutionAgg?.[0]?.value || 0);

    const volumeMap = new Map(volumeAgg.map((entry) => [entry._id, entry]));
    const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
    const conversationVolume = Array.from({ length: periodDays }, (_, index) => {
      const pointDate = new Date(startDate);
      pointDate.setDate(startDate.getDate() + index);

      const key = pointDate.toISOString().slice(0, 10);
      const volumePoint = volumeMap.get(key);

      return {
        day: weekdayFormatter.format(pointDate),
        totalChats: Number(volumePoint?.totalChats || 0),
        resolved: Number(volumePoint?.resolvedChats || 0),
      };
    });

    const agentIds = agentAgg
      .map((entry) => String(entry?._id || ""))
      .filter(Boolean);
    const agents = agentIds.length > 0
      ? await Agents.find({ _id: { $in: agentIds } }).select({ fullName: 1 }).lean()
      : [];

    const agentLookup = new Map(
      agents.map((agent) => [String(agent?._id || ""), normalizeText(agent?.fullName, "Unknown Agent")]),
    );

    const agentPerformance = agentAgg.map((entry) => {
      const agentId = String(entry?._id || "");

      return {
        agentId,
        agentName: agentLookup.get(agentId) || "Unknown Agent",
        resolvedChats: Number(entry?.resolvedChats || 0),
        avgFirstResponseSeconds: toSeconds(Number(entry?.avgFirstResponseMs || 0)),
        avgResolutionSeconds: toSeconds(Number(entry?.avgResolutionMs || 0)),
      };
    });

    const segmentation = segmentationAgg?.[0] || {};
    const newUsers = Number(segmentation?.newUsers || 0);
    const returningUsers = Number(segmentation?.returningUsers || 0);

    const conversion = conversionAgg?.[0] || {};
    const conversionTotalChats = Number(conversion?.totalChats || 0);
    const leadChats = Number(conversion?.leadChats || 0);
    const chatToLeadPercent = conversionTotalChats > 0
      ? Number(((leadChats / conversionTotalChats) * 100).toFixed(1))
      : 0;

    const locationStats = {
      totalVisitors: 0,
      visitorsWithLocation: 0,
      topCountries: [],
      topCities: [],
      locationSources: [],
    };

    const countryCounter = new Map();
    const cityCounter = new Map();
    const sourceCounter = new Map();

    visitorLocationAgg.forEach((entry) => {
      const city = normalizeText(entry?.locationCity);
      const country = normalizeText(entry?.locationCountry);
      const source = normalizeText(entry?.locationSource);

      locationStats.totalVisitors += 1;

      if (city || country) {
        locationStats.visitorsWithLocation += 1;
      }

      if (country) {
        countryCounter.set(country, Number(countryCounter.get(country) || 0) + 1);
      }

      if (city || country) {
        const cityLabel = buildLocationLabel(city, country);
        cityCounter.set(cityLabel, Number(cityCounter.get(cityLabel) || 0) + 1);
      }

      const sourceLabel = buildLocationSourceLabel(source);
      sourceCounter.set(sourceLabel, Number(sourceCounter.get(sourceLabel) || 0) + 1);
    });

    locationStats.topCountries = Array.from(countryCounter.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([location, visitorCount]) => ({ location, visitorCount }));

    locationStats.topCities = Array.from(cityCounter.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([location, visitorCount]) => ({ location, visitorCount }));

    locationStats.locationSources = Array.from(sourceCounter.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([source, visitorCount]) => ({ source, visitorCount }));

    const stopWords = new Set([
      "about", "after", "again", "also", "am", "and", "are", "been", "before", "can", "chat",
      "could", "from", "have", "help", "hello", "here", "just", "like", "more", "please", "this",
      "that", "there", "they", "want", "when", "where", "with", "your", "you", "what", "will",
      "would", "thanks", "thank", "need", "into", "then", "them", "than", "were", "has", "had",
    ]);

    const keywordCounter = new Map();
    keywordMessages.forEach((entry) => {
      const text = String(entry?.message || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ");
      const words = text.split(/\s+/).filter((word) => word.length >= 4 && !stopWords.has(word));

      words.forEach((word) => {
        keywordCounter.set(word, Number(keywordCounter.get(word) || 0) + 1);
      });
    });

    const topKeywords = Array.from(keywordCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([keyword, count]) => ({ keyword, count }));

    return {
      periodDays,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      overview: {
        totalChats,
        totalUsers: distinctVisitors,
        totalMessages,
        averageResponseTimeSeconds: toSeconds(avgResponseMs),
        averageResolutionTimeSeconds: toSeconds(avgResolutionMs),
      },
      trends: {
        totalChatsPercent: toPercentChange(totalChats, previousTotalChats),
        totalUsersPercent: toPercentChange(distinctVisitors, previousDistinctVisitors),
        totalMessagesPercent: toPercentChange(totalMessages, previousTotalMessages),
        averageResponseTimePercent: toPercentChange(previousAvgResponseMs, avgResponseMs),
      },
      conversationVolume,
      advanced: {
        agentPerformance,
        customerSegmentation: {
          newUsers,
          returningUsers,
        },
        operations: {
          missedChats,
          slowResponses,
        },
        conversion: {
          totalChats: conversionTotalChats,
          leadChats,
          chatToLeadPercent,
        },
        conversationInsights: {
          topKeywords,
        },
        visitorLocations: locationStats,
      },
    };
  } catch (error) {
    logger.error(`Error fetching analytics summary: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to fetch analytics summary: ${error.message}`);
  }
};

export default {
  createConversation,
  getQueue,
  getActiveConversations,
  getVisitors,
  getVisitorById,
  getConversationHistory,
  getWidgetConversationHistory,
  getWidgetVisitorProfile,
  updateWidgetVisitorProfile,
  assignConversation,
  acceptConversation,
  transferConversation,
  endConversation,
  sendMessage,
  getMessagesByConversationId,
  getAnalyticsSummary,
  getAssignmentMode,
};

const normalizeStatusArray = (value, fallback = []) => {
  const source = Array.isArray(value) ? value : [value];
  const normalized = source
    .flatMap((entry) => String(entry || "").split(","))
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  return fallback;
};