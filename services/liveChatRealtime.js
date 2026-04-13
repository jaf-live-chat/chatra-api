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

      sendSocketMessage(socket, "CONNECTED", {
        databaseName: context.databaseName,
        tenantId: context.tenantId,
        role: context.role,
      });

      socket.on("PING", () => {
        sendSocketMessage(socket, "PONG", { ok: true });
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

  const allSockets = Array.from(liveChatServer.sockets.sockets.values());
  logger.info(`[BROADCAST START] Event: ${event}, Target: ${JSON.stringify(target)}, Total sockets: ${allSockets.length}`);

  let deliveredCount = 0;
  let rejectedCount = 0;

  for (const socket of allSockets) {
    const context = socket.data?.context;

    if (!shouldDeliver(context, target)) {
      rejectedCount++;
      logger.debug(`[BROADCAST REJECTED] Socket role: ${context?.role}, agentId: ${context?.agentId}, databaseName: ${context?.databaseName}`);
      continue;
    }

    deliveredCount++;
    logger.debug(`[BROADCAST DELIVERED] Socket role: ${context?.role}, agentId: ${context?.agentId}, databaseName: ${context?.databaseName}`);
    sendSocketMessage(socket, event, data);
  }

  logger.info(`[BROADCAST COMPLETE] Event: ${event}, Delivered: ${deliveredCount}, Rejected: ${rejectedCount}`);
};

export {
  initializeLiveChatWebSocket,
  broadcastLiveChatEvent,
};