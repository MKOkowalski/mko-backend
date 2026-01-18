import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import adminRouter from "./routes/admin.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
  credentials: true
}));

app.use(express.json());

app.use("/api/admin", adminRouter);

app.get("/ping", (req, res) => {
  res.json({ status: "OK" });
});

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
  console.log(`MKO backend running on http://localhost:${PORT}`);
});
