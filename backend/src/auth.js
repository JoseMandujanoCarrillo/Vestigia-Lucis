import jwt from "jsonwebtoken";

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
