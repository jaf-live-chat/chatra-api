import { WebSocketServer, WebSocket } from "ws";
import { getMasterConnection } from "../config/masterDB.js";
import { logger } from "../utils/logger.js";

let liveChatServer = null;
const socketContext = new WeakMap();

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

const parseContext = (request) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  return {
    databaseName: normalizeTenantKey(requestUrl.searchParams.get("databaseName") || requestUrl.searchParams.get("tenantDatabaseName")),
    tenantId: normalizeTenantKey(requestUrl.searchParams.get("tenantId")),
    apiKey: normalizeTenantKey(requestUrl.searchParams.get("apiKey")),
    role: normalizeTenantKey(requestUrl.searchParams.get("role")).toUpperCase(),
    agentId: normalizeTenantKey(requestUrl.searchParams.get("agentId")),
    visitorToken: normalizeTenantKey(requestUrl.searchParams.get("visitorToken") || requestUrl.searchParams.get("visitorId")),
    conversationId: normalizeTenantKey(requestUrl.searchParams.get("conversationId")),
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

  if (target.conversationId && context.conversationId !== target.conversationId) {
    return false;
  }

  return true;
};

const sendSocketMessage = (socket, event, data) => {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    }),
  );
};

const initializeLiveChatWebSocket = (server) => {
  if (liveChatServer) {
    return liveChatServer;
  }

  liveChatServer = new WebSocketServer({ server, path: "/ws/live-chat" });

  liveChatServer.on("connection", (socket, request) => {
    const context = parseContext(request);

    void (async () => {
      if (!context.databaseName && context.apiKey) {
        context.databaseName = await resolveDatabaseNameFromApiKey(context.apiKey);
      }

      if (!context.databaseName && !context.tenantId) {
        sendSocketMessage(socket, "ERROR", { message: "databaseName, tenantId, or apiKey is required." });
        socket.close();
        return;
      }

      socketContext.set(socket, context);

      sendSocketMessage(socket, "CONNECTED", {
        databaseName: context.databaseName,
        tenantId: context.tenantId,
        role: context.role,
      });

      socket.on("message", (rawMessage) => {
        try {
          const parsed = JSON.parse(rawMessage.toString());

          if (parsed?.type === "PING") {
            sendSocketMessage(socket, "PONG", { ok: true });
          }
        } catch (error) {
          logger.debug?.(`Live chat socket message ignored: ${error.message}`);
        }
      });

      socket.on("close", () => {
        socketContext.delete(socket);
      });
    })().catch((error) => {
      logger.error(`Live chat socket connection failed: ${error.message}`);
      sendSocketMessage(socket, "ERROR", { message: "Failed to establish live chat connection." });
      socket.close();
    });
  });

  return liveChatServer;
};

const broadcastLiveChatEvent = (target = {}, event, data) => {
  if (!liveChatServer) {
    return;
  }

  for (const socket of liveChatServer.clients) {
    const context = socketContext.get(socket);

    if (!shouldDeliver(context, target)) {
      continue;
    }

    sendSocketMessage(socket, event, data);
  }
};

export {
  initializeLiveChatWebSocket,
  broadcastLiveChatEvent,
};