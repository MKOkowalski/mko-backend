// src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import adsRouter from "./routes/ads.js";
import adSystemRouter from "./routes/adSystem.js";
import contactRouter from "./routes/contact.js";
import uploadsRouter from "./routes/uploads.js";
import { apiErrorHandler, apiNotFound } from "./middleware/errors.js";

const app = express();

// --- CORS ---
// When frontend is served from a different origin (e.g. Live Server on :5500),
// this needs to allow that origin. If CORS_ORIGIN is "*", we reflect the request
// origin (required when credentials=true).
const corsOrigin = process.env.CORS_ORIGIN || "*";
const corsOptions = {
  origin:
    corsOrigin === "*"
      ? true
      : corsOrigin
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/ping", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/ads", adsRouter);
app.use("/api/ad-system", adSystemRouter);
app.use("/api/contact", contactRouter);
app.use("/api/uploads", uploadsRouter);

// Unified API 404 + error handler (keep at the end of /api stack)
app.use("/api", apiNotFound);
app.use(apiErrorHandler);

// --- Static frontend ---
// Serve the project root (HTML/CSS/JS) so "npm start" in backend gives you
// one URL for both frontend and API.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_DIR = path.resolve(__dirname, "..", ".."); // -> project root
app.use(express.static(STATIC_DIR));

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`MKO backend running on http://localhost:${PORT}`);
});
