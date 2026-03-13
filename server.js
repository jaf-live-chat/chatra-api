import { createServer } from 'http';
import { API_VERSION, APP_NAME, CORS_OPTIONS, PORT } from './constants/constants.js';
import { logger } from './utils/logger.js';
import { COLORS } from './constants/colors.js';
import { connectMasterDB } from './config/masterDB.js';

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const httpServer = createServer(app); // Socket.io needs the raw http.Server

app.use(cors(CORS_OPTIONS));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true, parameterLimit: 50000 }));

app.get(`/api/${API_VERSION}`, (_req, res) => {
  res.json({
    success: true,
    message: `${APP_NAME} API is running`,
    version: API_VERSION,
    environment: process.env.NODE_ENV,
  });
});

const startServer = async () => {
  try {
    await connectMasterDB();

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