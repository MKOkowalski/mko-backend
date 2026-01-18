// src/middleware/optionalAuth.js
export default function optionalAuth(req, res, next) {
  // Attach a dev user if headers provided; otherwise continue anonymously.
  const userId = req.headers["x-user-id"];
  if (userId) {
    req.user = { id: String(userId), role: req.headers["x-user-role"] || "user" };
  }
  return next();
}
export const optionalAuthMiddleware = optionalAuth;
