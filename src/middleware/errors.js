// src/middleware/errors.js
// Unified API error responses for better UX.

export class ApiError extends Error {
  constructor(status = 500, code = "INTERNAL_ERROR", message = "Wystąpił błąd.") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// 404 for unknown /api routes
export function apiNotFound(req, res) {
  return res.status(404).json({
    ok: false,
    code: "NOT_FOUND",
    message: "Nie znaleziono zasobu.",
  });
}

// Express error handler (must have 4 args)
export function apiErrorHandler(err, req, res, next) {
  // JSON body parse errors
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({
      ok: false,
      code: "INVALID_JSON",
      message: "Nieprawidłowy format danych (JSON).",
    });
  }

  // Rate limit (express-rate-limit)
  if (err && err.status === 429) {
    return res.status(429).json({
      ok: false,
      code: "RATE_LIMITED",
      message: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
    });
  }

  const status = Number(err?.status) || 500;
  const code = String(err?.code || err?.error || "INTERNAL_ERROR");
  const message = String(err?.message || "Wystąpił błąd.");

  // Never leak stack traces to client
  if (status >= 500) {
    console.error("[API]", code, message);
  }

  return res.status(status).json({
    ok: false,
    code,
    message,
  });
}
