import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

let listenersAttached = false;
let closingIntentionally = false;

const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('disconnected', () => {
    if (!closingIntentionally) logger.warn('[db] MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => logger.info('[db] MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error('[db] MongoDB error:', err.message));
};

/** The project's database. Used when neither MONGODB_DB_NAME nor the URI names one. */
export const DEFAULT_DB_NAME = 'real_time_chat';

/** "mongodb+srv://host/real_time_chat?x=y" → "real_time_chat" ("" when the URI has no database). */
export function databaseNameFromUri(uri) {
  const rest = String(uri).split('://')[1] || '';
  const slash = rest.indexOf('/');
  return slash === -1 ? '' : decodeURIComponent(rest.slice(slash + 1).split('?')[0]);
}

/**
 * MONGODB_DB_NAME → database in the URI → real_time_chat.
 * Never falls back to the driver's implicit "test" database (Atlas strings often omit the name).
 */
export const resolveDatabaseName = (uri) => config.db.dbName || databaseNameFromUri(uri) || DEFAULT_DB_NAME;

/** Hides credentials and query options: "mongodb+srv://user:pass@host/db?x" → "mongodb+srv://****@host/db". */
export const redactUri = (uri) => uri.split('?')[0].replace(/\/\/[^@/]*@/, '//****@');

/**
 * Connects to MongoDB using MONGODB_URI — your local MongoDB in development and
 * MongoDB Atlas in production (see server/.env.example).
 */
export async function connectDatabase(uri = config.db.uri) {
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it to server/.env (see server/.env.example for the local development value); ' +
        'in production set it to your MongoDB Atlas connection string.'
    );
  }

  attachListeners();
  const dbName = resolveDatabaseName(uri);
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 20,
    autoIndex: !config.isProd || process.env.MONGODB_AUTO_INDEX === 'true',
  });

  logger.info(`[db] Connected to MongoDB (${redactUri(uri)}) · database "${mongoose.connection.db.databaseName}"`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  closingIntentionally = true;
  await mongoose.disconnect();
}
