import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Ensure .env is loaded relative to the backend root, not the runtime CWD
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const candidates = [
  path.resolve(__dirname, '../.env'), // backend root
  path.resolve(__dirname, '../../.env'), // repo root fallback
];
let usedEnvPath = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    usedEnvPath = p;
    break;
  }
}

// Debug env loading
const maskedUri = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/:\w+@/, ':****@')
  : undefined;

console.log('[ENV DEBUG]', {
  candidates,
  usedEnvPath,
  hasUri: !!process.env.MONGODB_URI,
  uri: maskedUri,
});

console.log('[FIREBASE ENV DEBUG]', {
  projectId: process.env.FIREBASE_PROJECT_ID || 'MISSING',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'MISSING',
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? `Loaded ${process.env.FIREBASE_PRIVATE_KEY.length} chars`
    : 'MISSING',
});

import http from 'http';
// IMPORTANT: dynamically import modules that depend on env AFTER dotenv has run
let app, connectDB, logger, initTelegramBot;
async function loadModules() {
  const appMod = await import('./app.js');
  const dbMod = await import('./config/db.js');
  const logMod = await import('./utils/logger.js');
  const tgMod = await import('./utils/telegramBot.js');
  app = appMod.default;
  connectDB = dbMod.connectDB;
  logger = logMod.logger;
  initTelegramBot = tgMod.initTelegramBot;
}

const PORT = process.env.PORT || 4000;

async function start() {
  await loadModules();
  try {
    // Try to connect to database (don't fail if it doesn't work in dev mode)
    if (process.env.NODE_ENV !== 'development') {
      await connectDB();
    } else {
      try {
        await connectDB();
        logger.info('✅ Database connected successfully');
      } catch (err) {
        logger.warn('⚠️  Database connection failed, running in offline mode:', err.message);
      }
    }

    // Create server
    const server = http.createServer(app);

    // Start listening
    server.listen(PORT, () => {
      logger.info(`🚀 NagarMitra API listening on port ${PORT}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🌐 CORS Origins: ${process.env.CORS_ORIGIN}`);
      
      // Initialize Telegram Bot
      initTelegramBot();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Rejection: ${err.message}`);
      server.close(() => process.exit(1));
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught Exception: ${err.message}`);
      process.exit(1);
    });
  } catch (err) {
    logger.error(`❌ Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

start();
