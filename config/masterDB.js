import { COLORS, MASTER_DB_NAME } from '../constants/constants.js';
import mongoose from 'mongoose';

let masterConnection = null;
export const connectMasterDB = async () => {
  if (masterConnection && masterConnection.readyState === 1) {
    return masterConnection;
  }

  const uri =
    process.env.NODE_ENV === 'production'
      ? process.env.MONGO_URI_PROD
      : process.env.MONGO_URI_LOCAL;

  if (!uri) {
    throw new Error(
      'MongoDB URI is not set. Check MONGO_URI_LOCAL / MONGO_URI_PROD in your .env file.'
    );
  }

  try {
    await mongoose.connect(uri, { dbName: MASTER_DB_NAME });
    masterConnection = mongoose.connection;

    console.log(
      COLORS.fg.green,
      `[MasterDB] Connected → ${MASTER_DB_NAME}`,
      COLORS.reset
    );

    masterConnection.on('disconnected', () => {
      console.warn(COLORS.fg.yellow, '[MasterDB] Disconnected from MongoDB', COLORS.reset);
    });

    masterConnection.on('error', (err) => {
      console.error(COLORS.fg.red, `[MasterDB] Connection error: ${err.message}`, COLORS.reset);
    });

    return masterConnection;
  } catch (error) {
    console.error(
      COLORS.fg.red,
      `[MasterDB] Failed to connect: ${error.message}`,
      COLORS.reset
    );
    throw error;
  }
};

export const getMasterConnection = () => {
  if (!masterConnection || masterConnection.readyState !== 1) {
    throw new Error(
      '[MasterDB] Connection is not ready. Ensure connectMasterDB() is awaited during startup.'
    );
  }
  return masterConnection;
};
