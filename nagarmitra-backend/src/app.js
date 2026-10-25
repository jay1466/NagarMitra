import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { logger, httpLogger } from './utils/logger.js';

const app = express();

// Render (and most hosts) sit behind one proxy hop; without this every user
// shares the proxy's IP and one rate-limit bucket.
app.set('trust proxy', 1);

// Security & basic middlewares
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*'}));
app.use(express.json({ limit: '5mb' }));
// Malformed JSON bodies should be a 400, not a 500
app.use((err, _req, res, next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  return next(err);
});
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(httpLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a minute and try again.' },
});
app.use(limiter);

// Health & API routes
app.get('/', (_req, res) => res.send({ name: 'NagarMitra API', status: 'ok' }));
app.use('/api/v1', routes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
