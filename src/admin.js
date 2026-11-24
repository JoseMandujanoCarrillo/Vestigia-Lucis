import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";
import { requireAuth, requireSuperadmin } from "./auth.js";
import { contributorSummarySql, parseMultiline, parseTags, slugify, validYouTubeUrl } from "./helpers.js";

const router = Router();
const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../uploads");
function cloudinaryConfigFromUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CLOUDINARY_URL no tiene un formato válido.");
  }
  if (url.protocol !== "cloudinary:" || !url.hostname || !url.username || !url.password) {
    throw new Error("CLOUDINARY_URL debe incluir API key, API secret y cloud name.");
  }
  return {
    cloud_name: url.hostname,
    api_key: decodeURIComponent(url.username),
    api_secret: decodeURIComponent(url.password),
    secure: true
  };
}

const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_URL);
if (cloudinaryConfigured) {
  cloudinary.config(cloudinaryConfigFromUrl(process.env.CLOUDINARY_URL));
} else {
  await mkdir(uploadDirectory, { recursive: true });
}

const localStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const cloudinaryStorage = {
  _handleFile(_req, file, callback) {
    let completed = false;
    const finish = (error, result) => {
      if (completed) return;
      completed = true;
      if (error) return callback(error);
      if (!result?.secure_url || !result.public_id) {
        return callback(new Error("Cloudinary no devolvió la URL de la imagen."));
      }
      callback(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
    };
    const stream = cloudinary.uploader.upload_stream({
      folder: "vestigia-lucis/saints",
      public_id: randomUUID(),
      resource_type: "image"
    }, finish);
    file.stream.on("error", (error) => stream.destroy(error));
    stream.on("error", (error) => finish(error));
    file.stream.pipe(stream);
  },
  _removeFile(_req, file, callback) {
    if (!file.filename) return callback(null);
    cloudinary.uploader.destroy(file.filename, { resource_type: "image" })
      .then(() => callback(null))
      .catch(callback);
  }
};
const upload = multer({
  storage: cloudinaryConfigured ? cloudinaryStorage : localStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    callback(allowed.has(file.mimetype) ? null : new Error("Solo se permiten imágenes JPG, PNG o WebP."), allowed.has(file.mimetype));
  }
});
const images = upload.fields([
  { name: "image_1", maxCount: 1 }, { name: "image_2", maxCount: 1 }, { name: "image_3", maxCount: 1 }
]);

router.use(requireAuth);
router.use((req, res, next) => images(req, res, (error) => {
  if (error) {
    console.error("Error al guardar imágenes:", error.message);
    const badRequest = error instanceof multer.MulterError || error.message.startsWith("Solo se permiten");
    return res.status(badRequest ? 400 : 502).json({
      error: badRequest ? error.message : "No se pudieron guardar las imágenes en Cloudinary."
    });
  }
  next();
}));

router.get("/admins", requireSuperadmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, is_superadmin, created_at FROM admins ORDER BY created_at ASC, id ASC"
    );
    res.json({ admins: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/admins", requireSuperadmin, async (req, res, next) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!name || name.length > 120) {
    return res.status(400).json({ error: "El nombre es obligatorio y no debe exceder 120 caracteres." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Escribe un correo electrónico válido." });
  }
  if (password.length < 12) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 12 caracteres." });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at",
      [name, email, passwordHash]
    );
    res.status(201).json({ admin: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    next(error);
  }
});

router.put("/admins/:id", requireSuperadmin, async (req, res, next) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!name || name.length > 120) {
    return res.status(400).json({ error: "El nombre es obligatorio y no debe exceder 120 caracteres." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Escribe un correo electrónico válido." });
  }
  if (password && password.length < 12) {
    return res.status(400).json({ error: "La contraseña nueva debe tener al menos 12 caracteres." });
  }
  try {
    const existing = await pool.query(
      "SELECT id, is_superadmin FROM admins WHERE id = $1",
      [req.params.id]
    );
    if (!existing.rowCount) return res.status(404).json({ error: "No encontramos esa cuenta." });
    if (existing.rows[0].is_superadmin) {
      return res.status(403).json({ error: "La cuenta principal solo puede cambiar su contraseña desde Mi cuenta." });
    }

    const values = [name, email];
    let passwordClause = "";
    if (password) {
      values.push(await bcrypt.hash(password, 12));
      passwordClause = `, password_hash = $${values.length}`;
    }
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE admins SET name = $1, email = $2${passwordClause} WHERE id = $${values.length}
       RETURNING id, name, email, created_at`,
      values
    );
    res.json({ admin: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    next(error);
  }
});

router.delete("/admins/:id", requireSuperadmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM admins WHERE id = $1 AND is_superadmin = FALSE AND id <> $2 RETURNING id",
      [req.params.id, req.admin.id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "No encontramos una cuenta eliminable. La cuenta principal no se puede borrar." });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/saints", async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        COALESCE((SELECT json_agg(json_build_object('id', m.id, 'title', m.title, 'description', m.description) ORDER BY m.id)
          FROM miracles m WHERE m.saint_id = s.id), '[]'::json) AS miracles,
        COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
          FROM saint_tags st JOIN tags t ON t.id = st.tag_id WHERE st.saint_id = s.id), '[]'::json) AS tags,
        ${contributorSummarySql}
      FROM saints s
      ORDER BY s.updated_at DESC, s.name ASC
      LIMIT 500
    `);
    res.json({ saints: result.rows });
  } catch (error) {
    next(error);
  }
});

function contentFromRequest(body, files, existing = {}) {
  const name = String(body.name || "").trim();
  const shortDescription = String(body.short_description || "").trim();
  const originPlace = String(body.origin_place || "").trim();
  const youtubeUrl = String(body.youtube_url || "").trim() || null;
  if (!name || !shortDescription || !originPlace) throw Object.assign(new Error("Nombre, descripción breve y procedencia son obligatorios."), { status: 400 });
  if (!validYouTubeUrl(youtubeUrl)) throw Object.assign(new Error("La URL debe corresponder a YouTube."), { status: 400 });

  const imageUrls = [1, 2, 3].map((number) => {
    const file = files?.[`image_${number}`]?.[0];
    if (!file) return existing[`image_${number}_url`] || null;
    return cloudinaryConfigured ? file.path : `/uploads/${file.filename}`;
  });
  const published = body.is_published === undefined ? true : body.is_published === "true" || body.is_published === true;
  if (published && imageUrls.some((url) => !url)) throw Object.assign(new Error("Para publicar se requieren las tres imágenes."), { status: 400 });

  return {
    name, shortDescription, originPlace, youtubeUrl, imageUrls, published,
    biography: String(body.biography || "").trim() || null,
    country: String(body.country || "").trim() || null,
    birthDate: String(body.birth_date || "").trim() || null,
    deathDate: String(body.death_date || "").trim() || null,
    feastDay: String(body.feast_day || "").trim() || null,
    patronages: String(body.patronages || "").trim() || null,
    miracles: parseMultiline(body.miracles),
    tags: parseTags(body.tags)
  };
}

async function replaceRelations(client, saintId, content) {
  await client.query("DELETE FROM miracles WHERE saint_id = $1", [saintId]);
  for (const miracle of content.miracles) {
    await client.query("INSERT INTO miracles (saint_id, title, description) VALUES ($1, $2, $3)", [saintId, miracle.title, miracle.description]);
  }
  await client.query("DELETE FROM saint_tags WHERE saint_id = $1", [saintId]);
  for (const name of content.tags) {
    const tag = await client.query(
      "INSERT INTO tags (name, category) VALUES ($1, 'general') ON CONFLICT (name, category) DO UPDATE SET name = EXCLUDED.name RETURNING id",
      [name]
    );
    await client.query("INSERT INTO saint_tags (saint_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [saintId, tag.rows[0].id]);
  }
}

router.post("/saints", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const content = contentFromRequest(req.body, req.files);
    await client.query("BEGIN");
    const baseSlug = slugify(content.name) || "santo";
    const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
    const result = await client.query(`
      INSERT INTO saints (
        slug, name, short_description, biography, origin_place, country, birth_date,
        death_date, feast_day, patronages, image_1_url, image_2_url, image_3_url,
        youtube_url, is_published, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      slug, content.name, content.shortDescription, content.biography, content.originPlace,
      content.country, content.birthDate, content.deathDate, content.feastDay, content.patronages,
      ...content.imageUrls, content.youtubeUrl, content.published, req.admin.id
    ]);
    await replaceRelations(client, result.rows[0].id, content);
    await client.query(`
      INSERT INTO saint_contributions (saint_id, admin_id, contributor_name, action)
      SELECT $1, id, name, 'created' FROM admins WHERE id = $2
    `, [result.rows[0].id, req.admin.id]);
    await client.query("COMMIT");
    res.status(201).json({ saint: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

router.put("/saints/:id", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const existing = await client.query("SELECT * FROM saints WHERE id = $1", [req.params.id]);
    if (!existing.rowCount) return res.status(404).json({ error: "No encontramos ese santo." });
    const content = contentFromRequest(req.body, req.files, existing.rows[0]);
    await client.query("BEGIN");
    const result = await client.query(`
      UPDATE saints SET name=$1, short_description=$2, biography=$3, origin_place=$4,
        country=$5, birth_date=$6, death_date=$7, feast_day=$8, patronages=$9,
        image_1_url=$10, image_2_url=$11, image_3_url=$12, youtube_url=$13,
        is_published=$14, updated_at=NOW()
      WHERE id=$15 RETURNING *
    `, [
      content.name, content.shortDescription, content.biography, content.originPlace,
      content.country, content.birthDate, content.deathDate, content.feastDay,
      content.patronages, ...content.imageUrls, content.youtubeUrl, content.published, req.params.id
    ]);
    await replaceRelations(client, req.params.id, content);
    await client.query(`
      INSERT INTO saint_contributions (saint_id, admin_id, contributor_name, action)
      SELECT $1, id, name, 'updated' FROM admins WHERE id = $2
    `, [req.params.id, req.admin.id]);
    await client.query("COMMIT");
    res.json({ saint: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

router.delete("/saints/:id", async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM saints WHERE id=$1 RETURNING id", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "No encontramos ese santo." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
