import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL. Configura las variables de entorno del API.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: true }
});

pool.on("error", (error) => {
  console.error("Error inesperado en el pool de PostgreSQL:", error);
});
