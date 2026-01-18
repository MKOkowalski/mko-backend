// src/routes/ads.js
import express from "express";
import optionalAuth from "../middleware/optionalAuth.js";

const router = express.Router();

router.get("/ping", optionalAuth, (req, res) => {
  res.json({ ok: true, route: "ads", user: req.user || null });
});

// Example list endpoint
router.get("/", optionalAuth, (req, res) => {
  res.json({ ok: true, items: [] });
});

export default router;
