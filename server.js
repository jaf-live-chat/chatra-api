import { createServer } from 'http';
import { CronJob } from 'cron';
import { API_VERSION, APP_NAME, CORS_OPTIONS, PORT } from './constants/constants.js';
import { logger } from './utils/logger.js';
import { COLORS } from './constants/colors.js';
import { connectMasterDB } from './config/masterDB.js';
import { errorHandler, notFound } from './middlewares/errorMiddleware.js';
import { ensureStartupSeedData } from './services/master/startupSeederService.js';
import tenantServices from './services/master/tenantServices.js';

// ROUTE - IMPORTS

// master routes
import subscriptionRoutes from './routes/master/subscriptionRoutes.js';
import tenantRoutes from './routes/master/tenantRoutes.js';
import subscriptionPlanRoutes from './routes/master/subscriptionPlanRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import hitpayRoutes from './routes/hitpayRoutes.js';

// tenant routes
import agentRoutes from './routes/tenant/agentRoutes.js';

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const TENANT_SUBSCRIPTION_SYNC_CRON = '*/5 * * * *';

const app = express();
const httpServer = createServer(app); // Socket.io needs the raw http.Server

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
app.use(`/api/${API_VERSION}/tenants`, tenantRoutes);
app.use(`/api/${API_VERSION}/webhook`, hitpayRoutes);

app.use(notFound);
app.use(errorHandler)

const startServer = async () => {
  try {
    await connectMasterDB();
    await ensureStartupSeedData();

    const tenantSubscriptionSyncJob = new CronJob(
      TENANT_SUBSCRIPTION_SYNC_CRON,
      () => {
        void tenantServices.syncDueTenantSubscriptions().catch((error) => {
          logger.error(`Failed to sync due tenant subscriptions: ${error.message}`);
        });
      },
      null,
      false
    );

    tenantSubscriptionSyncJob.start();

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