// src/routes/uploads.js
import express from "express";

const router = express.Router();

router.get("/ping", (req, res) => res.json({ ok: true, route: "uploads" }));

// If you need real uploads, install multer and implement here.
router.post("/", (req, res) => {
  res.status(501).json({ ok: false, error: "NOT_IMPLEMENTED", hint: "Install multer and implement uploads in src/routes/uploads.js" });
});

export default router;
