import { logger } from './logger.js';

// Map an exception to a safe HTTP response: client mistakes become 4xx with a
// readable message, anything unexpected is logged and hidden behind a 500.
export function sendError(res, err, context = 'Request failed') {
  if (err?.name === 'ValidationError') {
    const message = Object.values(err.errors || {}).map((e) => e.message).join(', ');
    return res.status(400).json({ error: message || 'Invalid data' });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path || 'id'}` });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Duplicate record' });
  }
  logger.error(context, { message: err?.message, stack: err?.stack });
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// Parse pagination query params into safe, bounded numbers.
export function parsePaging(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

const MAX_IMAGE_CHARS = 1_500_000; // ~1.1 MB of JPEG once base64-encoded

// Accept an inline JPEG/PNG data URI or an http(s) URL; anything else is dropped.
export function cleanImage(value) {
  if (typeof value !== 'string' || !value) return undefined;
  if (/^https?:\/\//i.test(value)) return value.slice(0, 2048);
  if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value) && value.length <= MAX_IMAGE_CHARS) return value;
  return undefined;
}
