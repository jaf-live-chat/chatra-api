import { createServer } from 'http';
import { API_VERSION, APP_NAME, CORS_OPTIONS, PORT } from './constants/constants.js';
import { logger } from './utils/logger.js';
import { COLORS } from './constants/colors.js';
import { connectMasterDB } from './config/masterDB.js';
import { errorHandler, notFound } from './middlewares/errorMiddleware.js';
import { ensureStartupSeedData } from './services/master/startupSeederService.js';
import { initializeLiveChatWebSocket } from './services/liveChatRealtime.js';

// ROUTE - IMPORTS

// master routes
import subscriptionRoutes from './routes/master/subscriptionRoutes.js';
import tenantRoutes from './routes/master/tenantRoutes.js';
import subscriptionPlanRoutes from './routes/master/subscriptionPlanRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import hitpayRoutes from './routes/hitpayRoutes.js';
import faqRoutes from './routes/master/faqRoutes.js';
import notificationRoutes from './routes/master/notificationRoutes.js';
import quickRepliesRoutes from './routes/tenant/quickRepliesRoutes.js';
import chatSettingsRoutes from './routes/tenant/chatSettingsRoutes.js';
import liveChatRoutes from './routes/tenant/liveChatRoutes.js';
import liveChatWidgetRoutes from './routes/tenant/liveChatWidgetRoutes.js';
import companyInfoRoutes from './routes/master/companyInfoRoutes.js';
import widgetSettingsRoutes from './routes/tenant/widgetSettingsRoutes.js';

// tenant routes
import agentRoutes from './routes/tenant/agentRoutes.js';
import quickMessageRoutes from './routes/tenant/quickMessageRoutes.js';
import tenantNotificationRoutes from './routes/tenant/notificationRoutes.js';

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';



dotenv.config();

const app = express();
const httpServer = createServer(app);

initializeLiveChatWebSocket(httpServer);

app.use(cors(CORS_OPTIONS));
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({
  limit: '10mb',
  extended: true,
  parameterLimit: 50000,
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

app.get(`/api/${API_VERSION}`, (_req, res) => {
  res.json({
    success: true,
    message: `${APP_NAME} API is running`,
    version: API_VERSION,
    environment: process.env.NODE_ENV,
  });
});

// ROUTES
app.use(`/api/${API_VERSION}/subscriptions`, subscriptionRoutes);
app.use(`/api/${API_VERSION}/subscription-plans`, subscriptionPlanRoutes);
app.use(`/api/${API_VERSION}/payments`, paymentRoutes);
app.use(`/api/${API_VERSION}/agents`, agentRoutes);
app.use(`/api/${API_VERSION}/quick-messages`, quickMessageRoutes);
app.use(`/api/${API_VERSION}/tenants`, tenantRoutes);
app.use(`/api/${API_VERSION}/webhook`, hitpayRoutes);
app.use(`/api/${API_VERSION}/faqs`, faqRoutes);
app.use(`/api/${API_VERSION}/notifications`, notificationRoutes);
app.use(`/api/${API_VERSION}/quick-replies`, quickRepliesRoutes);
app.use(`/api/${API_VERSION}/chat-settings`, chatSettingsRoutes);
app.use(`/api/${API_VERSION}/widget-settings`, widgetSettingsRoutes);
app.use(`/api/${API_VERSION}/company-info`, companyInfoRoutes);
app.use(`/api/${API_VERSION}/agent-notifications`, tenantNotificationRoutes);
app.use(`/api/${API_VERSION}`, liveChatRoutes);
app.use(`/api/${API_VERSION}/widget/live-chat`, liveChatWidgetRoutes);

app.use(notFound);
app.use(errorHandler)

const startServer = async () => {
  try {
    await connectMasterDB();
    await ensureStartupSeedData();

    httpServer.listen(PORT, () => {
      console.log(
        COLORS.fg.yellow,
        `${APP_NAME} API·${process.env.NODE_ENV} environment · Listening on port ${PORT}`,
        COLORS.reset
      );
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();