// src/routes/adSystem.js
import express from "express";
import { adminRequired } from "../middleware/auth.js";

const router = express.Router();

router.get("/ping", adminRequired, (req, res) => {
  res.json({ ok: true, route: "adSystem" });
});

export default router;
