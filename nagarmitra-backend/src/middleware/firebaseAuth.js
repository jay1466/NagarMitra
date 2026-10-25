import { firebaseAdmin } from '../config/firebaseAdmin.js';

export function requireFirebaseAuth({ requireVerified = true } = {}) {
  return async function (req, res, next) {
    try {
      if (!firebaseAdmin?.apps?.length && process.env.NODE_ENV === 'development') {
           console.log("⚠️  Using mock Firebase auth because server lacks credentials.");
           req.user = { uid: "mock-uid-dev", email: "test@example.com", email_verified: true };
           return next();
      }

      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : null;
      if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

      const decoded = await firebaseAdmin.auth().verifyIdToken(token);
      if (requireVerified && !decoded.email_verified) {
        return res.status(403).json({ error: 'Email not verified' });
      }
      req.user = decoded; // contains uid, email, etc.
      next();
    } catch (err) {
      if (!firebaseAdmin?.apps?.length && process.env.NODE_ENV === 'development') {
        req.user = { uid: "mock-uid-dev", email: "test@example.com", email_verified: true };
        return next();
      }
      return res.status(401).json({ error: 'Invalid or expired token', detail: err.message });
    }
  };
}

// Attach req.user when a valid token is sent, but never reject the request.
export function optionalFirebaseAuth() {
  return async function (req, _res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (token && firebaseAdmin?.apps?.length) {
      try {
        req.user = await firebaseAdmin.auth().verifyIdToken(token);
      } catch {
        req.user = undefined;
      }
    }
    next();
  };
}
