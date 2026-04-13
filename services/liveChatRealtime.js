import { Server } from "socket.io";
import { getMasterConnection } from "../config/masterDB.js";
import { logger } from "../utils/logger.js";

let liveChatServer = null;

const normalizeTenantKey = (value) => String(value || "").trim();

const resolveDatabaseNameFromApiKey = async (apiKey) => {
  const normalizedApiKey = normalizeTenantKey(apiKey);

  if (!normalizedApiKey) {
    return "";
  }

  const { APIKey, Tenant } = getMasterConnection();
  const apiKeyRecord = await APIKey.findOne({ apiKey: normalizedApiKey }).lean();

  if (apiKeyRecord?.tenantId) {
    const tenant = await Tenant.findById(apiKeyRecord.tenantId).lean();
    return normalizeTenantKey(tenant?.databaseName);
  }

  const tenant = await Tenant.findOne({ apiKey: normalizedApiKey }).lean();
  return normalizeTenantKey(tenant?.databaseName);
};

const normalizeQueryValue = (value) => {
  if (Array.isArray(value)) {
    return normalizeTenantKey(value[0]);
  }

  return normalizeTenantKey(value);
};

const parseContext = (socket) => {
  const query = socket.handshake?.query || {};

  return {
    databaseName: normalizeQueryValue(query.databaseName || query.tenantDatabaseName),
    tenantId: normalizeQueryValue(query.tenantId),
    apiKey: normalizeQueryValue(query.apiKey),
    role: normalizeQueryValue(query.role).toUpperCase(),
    agentId: normalizeQueryValue(query.agentId),
    visitorToken: normalizeQueryValue(query.visitorToken || query.visitorId),
    conversationId: normalizeQueryValue(query.conversationId),
  };
};

const isSameTenant = (context, target) => {
  if (target.databaseName && context.databaseName !== target.databaseName) {
    return false;
  }

  if (target.tenantId && context.tenantId !== target.tenantId) {
    return false;
  }

  return true;
};

const shouldDeliver = (context, target = {}) => {
  if (!context) return false;

  if (!isSameTenant(context, target)) {
    return false;
  }

  if (Array.isArray(target.roles) && target.roles.length > 0 && !target.roles.includes(context.role)) {
    return false;
  }

  if (target.agentId && context.agentId !== target.agentId) {
    return false;
  }

  if (target.visitorToken && context.visitorToken !== target.visitorToken) {
    return false;
  }

  if (target.conversationId) {
    const normalizedRole = String(context.role || "").toUpperCase();
    const isVisitorContext = normalizedRole === "VISITOR";

    // Visitors are always scoped to a single conversation, while staff sockets
    // can subscribe at tenant/agent scope to receive conversation events.
    if (isVisitorContext && context.conversationId !== target.conversationId) {
      return false;
    }
  }

  return true;
};

const sendSocketMessage = (socket, event, data) => {
  if (!socket?.connected) {
    return;
  }

  const payload = data && typeof data === "object"
    ? data
    : { value: data };

  socket.emit(event, {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

const getTenantRoomName = (databaseName) => `tenant:${databaseName}`;
const getConversationRoomName = (conversationId) => `conversation:${conversationId}`;
const getAgentRoomName = (agentId) => `agent:${agentId}`;
const getVisitorRoomName = (visitorToken) => `visitor:${visitorToken}`;

const joinRooms = (socket, context) => {
  const { databaseName, conversationId, agentId, visitorToken, role } = context;

  // All connected users join their tenant room to receive tenant-level updates
  if (databaseName) {
    socket.join(getTenantRoomName(databaseName));
    logger.debug(`[ROOM] Socket ${socket.id} joined tenant room: ${getTenantRoomName(databaseName)}`);
  }

  // Agents join conversation room to receive messages for conversations they're assigned to
  if (conversationId && role !== "VISITOR") {
    socket.join(getConversationRoomName(conversationId));
    logger.debug(`[ROOM] Socket ${socket.id} (agent) joined conversation room: ${getConversationRoomName(conversationId)}`);
  }

  // Visitors join their conversation room to receive messages
  if (conversationId && role === "VISITOR") {
    socket.join(getConversationRoomName(conversationId));
    logger.debug(`[ROOM] Socket ${socket.id} (visitor) joined conversation room: ${getConversationRoomName(conversationId)}`);
  }

  // Agents join their personal agent room to receive assignments/transfers
  if (agentId && role !== "VISITOR") {
    socket.join(getAgentRoomName(agentId));
    logger.debug(`[ROOM] Socket ${socket.id} (agent) joined agent room: ${getAgentRoomName(agentId)}`);
  }
};

const initializeLiveChatWebSocket = (server) => {
  if (liveChatServer) {
    return liveChatServer;
  }

  liveChatServer = new Server(server, {
    path: "/ws/live-chat",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  liveChatServer.on("connection", (socket) => {
    const context = parseContext(socket);

    void (async () => {
      if (!context.databaseName && context.apiKey) {
        context.databaseName = await resolveDatabaseNameFromApiKey(context.apiKey);
      }

      if (!context.databaseName && !context.tenantId) {
        sendSocketMessage(socket, "ERROR", { message: "databaseName, tenantId, or apiKey is required." });
        socket.disconnect(true);
        return;
      }

      socket.data.context = context;

      // Join appropriate rooms based on context
      joinRooms(socket, context);

      sendSocketMessage(socket, "CONNECTED", {
        databaseName: context.databaseName,
        tenantId: context.tenantId,
        role: context.role,
        agentId: context.agentId,
        visitorToken: context.visitorToken,
      });

      logger.info(`[CONNECTED] Socket ${socket.id}: role=${context.role}, databaseName=${context.databaseName}, agentId=${context.agentId}`);

      // Ping handler for connection health check
      socket.on("PING", () => {
        sendSocketMessage(socket, "PONG", { ok: true });
      });

      // Typing indicator event
      socket.on("TYPING", (payload) => {
        const { conversationId } = payload;
        if (!conversationId || !context.databaseName) {
          return;
        }

        logger.debug(`[TYPING] Socket ${socket.id} typing in conversation ${conversationId}`);
        liveChatServer.to(getConversationRoomName(conversationId)).emit("TYPING", {
          conversationId,
          senderId: context.agentId || context.visitorToken,
          senderRole: context.role,
          timestamp: new Date().toISOString(),
        });
      });

      // Stop typing event
      socket.on("STOP_TYPING", (payload) => {
        const { conversationId } = payload;
        if (!conversationId || !context.databaseName) {
          return;
        }

        logger.debug(`[STOP_TYPING] Socket ${socket.id} stopped typing in conversation ${conversationId}`);
        liveChatServer.to(getConversationRoomName(conversationId)).emit("STOP_TYPING", {
          conversationId,
          senderId: context.agentId || context.visitorToken,
          senderRole: context.role,
          timestamp: new Date().toISOString(),
        });
      });

      // Client-initiated disconnect handler for cleanup
      socket.on("disconnect", () => {
        logger.info(`[DISCONNECTED] Socket ${socket.id}: role=${context.role}, databaseName=${context.databaseName}`);
      });
    })().catch((error) => {
      logger.error(`Live chat socket connection failed: ${error.message}`);
      sendSocketMessage(socket, "ERROR", { message: "Failed to establish live chat connection." });
      socket.disconnect(true);
    });
  });

  return liveChatServer;
};

const broadcastLiveChatEvent = (target = {}, event, data) => {
  if (!liveChatServer) {
    logger.warn(`[BROADCAST FAILED] No liveChatServer instance. Event: ${event}`);
    return;
  }

  const { databaseName, conversationId, agentId, visitorToken, roles } = target;

  // Determine target rooms based on what's specified
  const rooms = [];

  // Target specific conversation: send to conversation room
  if (conversationId) {
    rooms.push(getConversationRoomName(conversationId));
  }

  // Target specific agent: send to agent room
  if (agentId) {
    rooms.push(getAgentRoomName(agentId));
  }

  // Target tenant-wide: send to tenant room (all agents, no visitors)
  if (databaseName && !conversationId && !agentId) {
    rooms.push(getTenantRoomName(databaseName));
  }

  // If no specific targeting, still broadcast to tenant if databaseName is provided
  // This is fallback for backward compatibility
  if (rooms.length === 0 && databaseName) {
    rooms.push(getTenantRoomName(databaseName));
  }

  if (rooms.length === 0) {
    logger.warn(`[BROADCAST SKIPPED] Event: ${event}, Target: ${JSON.stringify(target)} - No valid rooms determined`);
    return;
  }

  const payload = data && typeof data === "object"
    ? { ...data, timestamp: new Date().toISOString() }
    : { value: data, timestamp: new Date().toISOString() };

  logger.info(`[BROADCAST] Event: ${event}, Rooms: ${rooms.join(", ")}, Target: ${JSON.stringify(target)}`);

  rooms.forEach((room) => {
    liveChatServer.to(room).emit(event, payload);
  });
};

export {
  initializeLiveChatWebSocket,
  broadcastLiveChatEvent,
};