// src/middleware/auth.js
// Minimal auth helpers – works even without JWT.
// If you later add real auth (JWT/session), you can extend these.

export function authRequired(req, res, next) {
  // If user already attached by some auth layer, accept.
  if (req.user) return next();

  // Allow passing "x-user-id" for local dev/testing.
  const userId = req.headers["x-user-id"];
  if (userId) {
    req.user = { id: String(userId), role: req.headers["x-user-role"] || "user" };
    return next();
  }

  return res.status(401).json({ ok: false, error: "AUTH_REQUIRED" });
}

export function adminRequired(req, res, next) {
  if (!req.user) {
    // Try to attach dev user if present
    const userId = req.headers["x-user-id"];
    if (userId) req.user = { id: String(userId), role: req.headers["x-user-role"] || "user" };
  }
  if (req.user && (req.user.role === "admin" || req.user.isAdmin === true)) return next();
  return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
}
