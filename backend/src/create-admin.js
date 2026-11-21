import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

try {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || password.length < 12) {
    throw new Error("Define ADMIN_EMAIL y una ADMIN_PASSWORD de al menos 12 caracteres en .env.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(`
    INSERT INTO admins (email, password_hash) VALUES ($1, $2)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING email
  `, [email, passwordHash]);
  console.log(`Administrador listo: ${result.rows[0].email}`);
} catch (error) {
  console.error("No se pudo crear el administrador:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
