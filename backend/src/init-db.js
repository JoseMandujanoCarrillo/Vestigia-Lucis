import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

try {
  const schemaPath = fileURLToPath(new URL("../schema.sql", import.meta.url));
  const schema = await readFile(schemaPath, "utf8");
  await pool.query(schema);
  console.log("Esquema de base de datos creado o actualizado.");
} catch (error) {
  console.error("No se pudo inicializar la base de datos:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
