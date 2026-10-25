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

// Verified login + the matching NagarMitra user record (created on first use) as req.me.
export function requireUser() {
  const verify = requireFirebaseAuth({ requireVerified: false });
  return (req, res, next) =>
    verify(req, res, async () => {
      try {
        const { default: User } = await import('../models/User.js');
        let me = await User.findByFirebaseUid(req.user.uid);
        if (!me) me = await User.createFromFirebaseUser(req.user);
        if (!me.isActive) return res.status(403).json({ error: 'This account has been deactivated' });
        req.me = me;
        next();
      } catch (err) {
        next(err);
      }
    });
}

// Like requireUser, but anonymous requests are allowed (req.me stays undefined).
export function optionalUser() {
  const attach = optionalFirebaseAuth();
  return (req, res, next) =>
    attach(req, res, async () => {
      try {
        if (req.user?.uid) {
          const { default: User } = await import('../models/User.js');
          req.me = (await User.findByFirebaseUid(req.user.uid)) || undefined;
        }
        next();
      } catch (err) {
        next(err);
      }
    });
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.me || !roles.includes(req.me.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this' });
    }
    next();
  };
}
