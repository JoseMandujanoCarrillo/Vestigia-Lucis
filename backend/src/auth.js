import jwt from "jsonwebtoken";
import { pool } from "./db.js";

export function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Debes iniciar sesión como administrador." });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "La sesión no es válida o expiró. Inicia sesión de nuevo." });
  }
}

export async function requireSuperadmin(req, res, next) {
  try {
    const result = await pool.query("SELECT is_superadmin FROM admins WHERE id = $1", [req.admin.id]);
    if (!result.rowCount) return res.status(401).json({ error: "La cuenta administradora ya no existe." });
    if (!result.rows[0].is_superadmin) {
      return res.status(403).json({ error: "Solo la administradora principal puede gestionar cuentas." });
    }
    next();
  } catch (error) {
    next(error);
  }
}
