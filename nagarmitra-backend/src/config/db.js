import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  let uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  // Ensure recommended params exist (helps avoid TLS issues & ensures retryWrites)
  const hasQuery = uri.includes('?');
  const defaults = 'retryWrites=true&w=majority&tls=true&appName=NagarMitra';
  if (hasQuery) {
    const params = new URLSearchParams(uri.split('?')[1]);
    if (!params.has('retryWrites')) params.set('retryWrites', 'true');
    if (!params.has('w')) params.set('w', 'majority');
    if (!params.has('tls')) params.set('tls', 'true');
    if (!params.has('appName')) params.set('appName', 'NagarMitra');
    uri = `${uri.split('?')[0]}?${params.toString()}`;
  } else {
    if (!uri.endsWith('/')) uri += '/';
    uri += `?${defaults}`;
  }

  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || 'nagarmitra',
      serverSelectionTimeoutMS: 15000,
    });
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('Mongo connection failed', {
      message: err.message,
      name: err.name,
      reason: err.reason?.stack || err.reason || undefined,
    });
    throw err;
  }
}
