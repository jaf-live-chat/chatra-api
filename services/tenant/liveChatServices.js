import { getTenantConnection } from "../../config/tenantDB.js";
import { CONVERSATION_STATUS, QUEUE_STATUS, USER_ROLES, USER_STATUS } from "../../constants/constants.js";
import { AppError, BadRequestError, ForbiddenError, InternalServerError, NotFoundError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { broadcastLiveChatEvent } from "../liveChatRealtime.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const normalizeText = (value, fallback = "") => String(value ?? fallback).trim();

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

const sanitizeMessage = (message) => {
  const messageObject = safeObject(message);
  if (!messageObject) return null;

  return messageObject;
};

const resolveRequestIpAddress = (req) => {
  const forwardedFor = normalizeText(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim() || "UNKNOWN";
  }

  const socketAddress = normalizeText(req.socket?.remoteAddress);
  return socketAddress || "UNKNOWN";
};

const resolveUserAgent = (req) => normalizeText(req.headers["user-agent"], "UNKNOWN") || "UNKNOWN";

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

const upsertVisitor = async (databaseName, payload, req) => {
  const { Visitors } = getTenantModels(databaseName);
  const visitorToken = resolveVisitorToken(req, payload);
  const visitorName = normalizeText(payload.name);
  const emailAddress = normalizeText(payload.emailAddress).toLowerCase();
  const ipAddress = resolveRequestIpAddress(req);
  const userAgent = resolveUserAgent(req);

  let visitor = null;

  if (visitorToken) {
    visitor = await Visitors.findOne({ visitorToken });
  }

  if (visitor) {
    visitor.lastSeenAt = new Date();
    visitor.ipAddress = ipAddress;
    visitor.userAgent = userAgent;

    if (visitorName) {
      visitor.name = visitorName;
    }

    if (emailAddress) {
      visitor.emailAddress = emailAddress;
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
      ipAddress,
      userAgent,
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

const claimAgent = async (databaseName, agentId) => {
  const { Agents } = getTenantModels(databaseName);

  return Agents.findOneAndUpdate(
    {
      _id: agentId,
      status: USER_STATUS.AVAILABLE,
    },
    {
      status: USER_STATUS.BUSY,
    },
    {
      new: true,
      runValidators: true,
    },
  ).lean();
};

const releaseAgent = async (databaseName, agentId) => {
  if (!agentId) {
    return;
  }

  const { Agents } = getTenantModels(databaseName);
  await Agents.findByIdAndUpdate(agentId, { status: USER_STATUS.AVAILABLE });
};

const buildConversationResponse = (conversation, queueEntry, visitor, agent, message = null) => ({
  conversation: sanitizeConversation(conversation),
  queueEntry: sanitizeQueueEntry(queueEntry),
  visitor: sanitizeVisitor(visitor),
  agent: sanitizeAgent(agent),
  initialMessage: message ? sanitizeMessage(message) : null,
});

const createConversation = async (payload = {}, req = {}) => {
  try {
    const { databaseName } = payload;
    ensureDatabaseName(databaseName);

    const chatSettings = await getOrCreateChatSettings(databaseName);
    const visitor = await upsertVisitor(databaseName, payload, req);
    const visitorToken = resolveVisitorToken(req, payload) || null;
    const { Conversations, Queue, Messages, Agents } = getTenantModels(databaseName);
    const now = new Date();

    const conversationBase = {
      visitorId: visitor._id,
      visitorToken,
      ipAddress: resolveRequestIpAddress(req),
      userAgent: resolveUserAgent(req),
      status: CONVERSATION_STATUS.WAITING,
      queuedAt: now,
      assignedAt: null,
      agentId: null,
    };

    let selectedAgent = null;

    if (String(chatSettings.assignmentMode || "ROUND_ROBIN").toUpperCase() === "ROUND_ROBIN") {
      const availableAgents = await Agents.find({ status: USER_STATUS.AVAILABLE })
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
      },
    ]);

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

    broadcastLiveChatEvent(
      {
        databaseName,
      },
      "NEW_CONVERSATION",
      buildConversationResponse(conversation, queueEntry, visitor, selectedAgent, initialMessage),
    );

    if (selectedAgent) {
      broadcastLiveChatEvent(
        {
          databaseName,
          agentId: String(selectedAgent._id),
          visitorToken,
          conversationId: String(conversation._id),
        },
        "CONVERSATION_ASSIGNED",
        buildConversationResponse(conversation, queueEntry, visitor, selectedAgent, initialMessage),
      );
    }

    if (initialMessage) {
      broadcastLiveChatEvent(
        {
          databaseName,
          conversationId: String(conversation._id),
          visitorToken,
          agentId: selectedAgent ? String(selectedAgent._id) : null,
        },
        "NEW_MESSAGE",
        sanitizeMessage(initialMessage),
      );
    }

    return buildConversationResponse(conversation, queueEntry, visitor, selectedAgent, initialMessage);
  } catch (error) {
    logger.error(`Error starting conversation: ${error.message}`);

    if (error instanceof AppError) {
      throw error;
    }

    throw new InternalServerError(`Failed to start conversation: ${error.message}`);
  }
};

const getQueue = async (payload = {}) => {
  try {
    const { databaseName, page, limit } = payload;
    ensureDatabaseName(databaseName);

    const { Queue } = getTenantModels(databaseName);
    const { page: currentPage, limit: currentLimit, skip } = parsePagination(page, limit);

    const query = { status: QUEUE_STATUS.WAITING };

    const [queueEntries, totalCount] = await Promise.all([
      Queue.find(query)
        .populate("conversationId")
        .populate("visitorId")
        .populate("agentId")
        .sort({ queuedAt: 1, createdAt: 1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      Queue.countDocuments(query),
    ]);

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / currentLimit) : 0;

    return {
      queue: queueEntries.map(sanitizeQueueEntry),
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

const assignWaitingConversationToAgent = async ({ databaseName, conversationId, claimedAgent }) => {
  const { Conversations, Queue } = getTenantModels(databaseName);
  const now = new Date();

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

  broadcastLiveChatEvent(
    {
      databaseName,
    },
    "CONVERSATION_ASSIGNED",
    buildConversationResponse(updatedConversation, updatedQueue, updatedConversation.visitorId, claimedAgent),
  );

  return buildConversationResponse(updatedConversation, updatedQueue, updatedConversation.visitorId, claimedAgent);
};

const assignConversation = async (payload = {}, req = {}) => {
  try {
    const { databaseName, conversationId, agentId } = payload;
    ensureDatabaseName(databaseName);

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

    if (!conversationId) {
      throw new BadRequestError("conversationId is required.");
    }

    if (!agentId) {
      throw new ForbiddenError("Authenticated agent is required.");
    }

    if (String(req.agent?.status || "").toUpperCase() !== USER_STATUS.AVAILABLE) {
      throw new ForbiddenError("Agent must be AVAILABLE to accept a conversation.");
    }

    const claimedAgent = await claimAgent(databaseName, agentId);

    if (!claimedAgent) {
      throw new ForbiddenError("Agent is not available.");
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
    let visitor = null;

    if (isVisitorMessage) {
      const requestVisitorToken = resolveVisitorToken(req, payload);
      visitor = await Visitors.findById(conversation.visitorId).lean();

      assertVisitorConversationAccess({
        conversation,
        requestVisitorToken,
        visitor,
      });

      senderId = visitor?._id || null;

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
      },
    ]);

    broadcastLiveChatEvent(
      {
        databaseName,
        conversationId: String(conversationId),
        visitorToken: normalizeText(conversation.visitorToken),
        agentId: conversation.agentId ? String(conversation.agentId) : null,
      },
      "NEW_MESSAGE",
      sanitizeMessage(createdMessage),
    );

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

    if (!req.agent) {
      const requestVisitorToken = resolveVisitorToken(req, payload);
      const visitor = conversation.visitorId
        ? await Visitors.findById(conversation.visitorId).lean()
        : null;

      assertVisitorConversationAccess({
        conversation,
        requestVisitorToken,
        visitor,
      });
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

export default {
  createConversation,
  getQueue,
  assignConversation,
  acceptConversation,
  sendMessage,
  getMessagesByConversationId,
  getAssignmentMode,
};