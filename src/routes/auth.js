// src/routes/auth.js
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import bcryptjs from "bcryptjs";

import { sendMail, isMailerConfigured } from "../services/mailer.js";
import { createRepoFromEnv } from "../repos/repoFactory.js";
import { isStrongPassword, isValidEmail, normalizeEmail } from "../services/utils.js";

const router = express.Router();

const repo = createRepoFromEnv();

const RESET_TTL_MIN = Number(process.env.RESET_TTL_MIN || 30); // 15–60 recommended
const RESET_DEBUG = String(process.env.RESET_DEBUG || "").toLowerCase() === "1";

function sha256hex(input){
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function isExpired(iso){
  return new Date(iso).getTime() <= Date.now();
}

function maskEmail(email){
  const s = String(email || "");
  const [u, d] = s.split("@");
  if(!u || !d) return "***";
  const u2 = u.length <= 2 ? u[0] + "*" : u.slice(0,2) + "***";
  return `${u2}@${d}`;
}

// Healthcheck
router.get("/ping", (req, res) => res.json({ ok: true, route: "auth" }));

// --- RESET PASSWORD (production-ish) ---
// Zasada: na request zawsze zwracamy ten sam komunikat, żeby nie ujawniać czy email istnieje.
// Token: jednorazowy + wygasa (domyślnie 30 min) + przechowywany jako hash w storage.

const resetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      ok: false,
      code: "RATE_LIMITED",
      message: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
    }),
});

const resetConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      ok: false,
      code: "RATE_LIMITED",
      message: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
    }),
});

async function handleResetRequest(req, res){
  const email = normalizeEmail(req.body?.email);

  // Nawet jak email jest zły, nie zdradzamy za dużo. Ale UX: pokaż "podaj email".
  if(!email){
    return res.status(400).json({ ok: false, code: "EMAIL_REQUIRED", message: "Podaj e-mail." });
  }
  if(!isValidEmail(email)){
    return res.status(400).json({ ok: false, code: "EMAIL_INVALID", message: "Podaj poprawny e-mail." });
  }

  // Sprzątanie wygasłych tokenów (best-effort)
  await repo.deleteTokensWhere(t => t.kind === 'reset_password' && t.expires_at && isExpired(t.expires_at));

  // Zawsze ta sama odpowiedź (anti-enumeration)
  const genericResponse = { ok: true, message: "Jeśli e-mail istnieje, wysłaliśmy link do resetu hasła." };

  // W becie nie zawsze mamy jeszcze system kont (users). Żeby dało się testować maila
  // i flow resetu, token wiążemy z e-mailem, a nie z user_id.
  // Unieważnij poprzednie tokeny resetu dla tego e-maila.
  await repo.deleteTokensWhere(
    t => t.kind === 'reset_password' && String(t.email || "").toLowerCase() === email
  );

  // Generate raw token and store only hash
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256hex(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000).toISOString();

  await repo.createToken({
    token_hash: tokenHash,
    email,
    kind: 'reset_password',
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:8787";
  const resetLink = `${String(frontendUrl).replace(/\/$/, "")}/reset-hasla.html?token=${encodeURIComponent(rawToken)}`;

  const subject = "MKO.pl – ustaw nowe hasło";
  const text = `Aby ustawić nowe hasło kliknij w link:\n\n${resetLink}\n\nLink wygaśnie za ${RESET_TTL_MIN} min. Jeśli to nie Ty prosiłeś o reset hasła, zignoruj tę wiadomość.`;
  const html = `
    <p>Aby ustawić nowe hasło kliknij w link:</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p style="color:#666;font-size:12px;">Link wygaśnie za ${RESET_TTL_MIN} min. Jeśli to nie Ty prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
  `;

  // W dev (lub gdy SMTP nie ma) możemy zwrócić token tylko gdy RESET_DEBUG=1.
  if(!isMailerConfigured()){
    console.warn("[AUTH] SMTP not configured.");
    if(RESET_DEBUG){
      return res.json({ ...genericResponse, devSent: false, resetToken: rawToken, resetLink });
    }
    return res.json(genericResponse);
  }

  const result = await sendMail({ to: email, subject, text, html });
  if(!result?.ok){
    console.warn(`[AUTH] reset mail failed for ${maskEmail(email)}`);
    // nadal nie zdradzamy nic – i tak OK
    return res.json(RESET_DEBUG ? { ...genericResponse, devSent: false } : genericResponse);
  }

  return res.json(RESET_DEBUG ? { ...genericResponse, devSent: true } : genericResponse);
}

async function handleResetConfirm(req, res){
  const token = String(req.body?.token || "").trim();
  const password = String(req.body?.newPassword || req.body?.password || "");

  if(!token) return res.status(400).json({ ok: false, code: "TOKEN_REQUIRED", message: "Brak tokena." });
  if(!isStrongPassword(password)){
    return res.status(400).json({ ok: false, code: "WEAK_PASSWORD", message: "Hasło musi mieć min. 8 znaków i zawierać literę oraz cyfrę." });
  }

  const tokenHash = sha256hex(token);
  const item = await repo.findTokenByHash(tokenHash, 'reset_password');
  if(!item){
    return res.status(400).json({ ok: false, code: "TOKEN_INVALID", message: "Token nieważny lub wygasł." });
  }
  if(item.expires_at && isExpired(item.expires_at)){
    await repo.deleteTokensWhere(t => t.kind === 'reset_password' && t.token_hash === tokenHash);
    return res.status(400).json({ ok: false, code: "TOKEN_EXPIRED", message: "Token nieważny lub wygasł." });
  }

  // One-time: consume
  await repo.consumeTokenByHash(tokenHash, 'reset_password');

  // W wersji "produkcyjnej" token jest powiązany z user_id.
  // W becie (gdy nie ma jeszcze systemu kont) token może być powiązany tylko z e-mailem.
  // Aktualizujemy hasło tylko jeśli użytkownik istnieje – ale odpowiedź pozostaje neutralna.
  let user = null;
  if(item.user_id != null){
    user = await repo.findUserById(item.user_id);
  }else if(item.email){
    user = await repo.findUserByEmail(String(item.email).toLowerCase());
  }

  if(user){
    const pass_hash = await bcryptjs.hash(password, 12);
    await repo.updateUser(user.id, { pass_hash });
  }

  return res.json({ ok: true, message: "Jeśli konto istnieje, hasło zostało zmienione." });
}

// Keep placeholders for now (frontend won't crash)
router.post("/login", (req, res) => {
  return res.status(501).json({ ok: false, code: "NOT_IMPLEMENTED", message: "Funkcja nie jest jeszcze dostępna." });
});

router.post("/register", (req, res) => {
  return res.status(501).json({ ok: false, code: "NOT_IMPLEMENTED", message: "Funkcja nie jest jeszcze dostępna." });
});

// New canonical endpoints (from README)
router.post("/reset/request", resetRequestLimiter, handleResetRequest);
router.post("/reset/confirm", resetConfirmLimiter, handleResetConfirm);

// Backwards-compatible endpoints still used by some frontend scripts
router.post("/request-reset", resetRequestLimiter, handleResetRequest);
router.post("/reset-password", resetRequestLimiter, handleResetRequest);

export default router;
