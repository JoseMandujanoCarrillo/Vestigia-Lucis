import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

try {
  const name = String(process.env.SUPERADMIN_NAME || "").trim();
  const email = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || "";
  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    throw new Error("Define SUPERADMIN_NAME, SUPERADMIN_EMAIL válido y SUPERADMIN_PASSWORD de al menos 12 caracteres.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(`
    INSERT INTO admins (name, email, password_hash, is_superadmin) VALUES ($1, $2, $3, TRUE)
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      password_hash = EXCLUDED.password_hash,
      is_superadmin = TRUE
    RETURNING email
  `, [name, email, passwordHash]);
  console.log(`Administrador listo: ${result.rows[0].email}`);
} catch (error) {
  console.error("No se pudo crear el administrador:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
