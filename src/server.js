import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { requireAuth } from "./auth.js";
import saintsRouter from "./saints.js";
import adminRouter from "./admin.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET es obligatorio y debe tener al menos 32 caracteres.");
}

const app = express();
const port = Number(process.env.PORT || 4000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const allowedOrigins = new Set([
  "https://vestigia-lucis.vercel.app",
  ...(process.env.FRONTEND_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origen no permitido."));
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads"), { dotfiles: "deny", index: false }));

const healthCheck = async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
};

app.get("/", healthCheck);
app.get("/api/health", healthCheck);

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ error: "Correo y contraseña son obligatorios." });
    const result = await pool.query("SELECT id, email, name, password_hash, is_superadmin FROM admins WHERE email = $1", [email]);
    const admin = result.rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }
    const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name, is_superadmin: admin.is_superadmin } });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, email, name, is_superadmin FROM admins WHERE id = $1",
      [req.admin.id]
    );
    if (!result.rowCount) return res.status(401).json({ error: "La cuenta administradora ya no existe." });
    res.json({ admin: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.put("/api/auth/password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.current_password || "");
    const newPassword = String(req.body?.new_password || "");
    const confirmPassword = String(req.body?.confirm_password || "");
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "Completa la contraseña actual y la nueva contraseña." });
    }
    if (newPassword.length < 12) {
      return res.status(400).json({ error: "La contraseña nueva debe tener al menos 12 caracteres." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "La confirmación no coincide con la contraseña nueva." });
    }
    const result = await pool.query("SELECT password_hash FROM admins WHERE id = $1", [req.admin.id]);
    if (!result.rowCount) return res.status(401).json({ error: "La cuenta administradora ya no existe." });
    if (!(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) {
      return res.status(401).json({ error: "La contraseña actual no es correcta." });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE admins SET password_hash = $1 WHERE id = $2", [passwordHash, req.admin.id]);
    res.json({ message: "Contraseña actualizada correctamente." });
  } catch (error) {
    next(error);
  }
});

app.use("/api/saints", saintsRouter);
app.use("/api/admin", adminRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === "23514") return res.status(400).json({ error: "Los datos no cumplen las reglas de la base de datos." });
  if (error.code === "22007" || error.code === "22008") return res.status(400).json({ error: "Una fecha no tiene un formato válido." });
  res.status(error.status || 500).json({ error: error.status ? error.message : "Error interno del API." });
});

const server = app.listen(port, () => console.log(`API lista en http://localhost:${port}`));

async function shutdown() {
  server.close();
  await pool.end();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
