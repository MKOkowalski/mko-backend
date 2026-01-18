// src/routes/contact.js
import express from "express";

const router = express.Router();

router.post("/", (req, res) => {
  // Accept contact form without crashing server
  res.json({ ok: true });
});

export default router;
