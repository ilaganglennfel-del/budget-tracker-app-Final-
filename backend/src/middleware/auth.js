const jwt = require('jsonwebtoken');

/**
 * Middleware: Verify JWT access token.
 * Extracts req.user = { uid, email } from the Bearer token.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'AUTH_EXPIRED', message: 'No token provided. Please log in.' },
    });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { uid: payload.sub, email: payload.email };
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'AUTH_EXPIRED' : 'AUTH_EXPIRED';
    return res.status(401).json({
      error: { code, message: 'Session expired. Please log in again.' },
    });
  }
}

module.exports = { authenticate };
