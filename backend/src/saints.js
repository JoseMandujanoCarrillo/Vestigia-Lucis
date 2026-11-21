import { Router } from "express";
import { pool } from "./db.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { q = "", name = "", miracle = "", origin = "", tag = "" } = req.query;
    const values = [];
    const where = ["s.is_published = TRUE"];
    const add = (value) => {
      values.push(`%${String(value).trim()}%`);
      return `$${values.length}`;
    };

    if (q) {
      const p = add(q);
      where.push(`(
        s.name ILIKE ${p} OR s.short_description ILIKE ${p} OR s.biography ILIKE ${p}
        OR s.origin_place ILIKE ${p} OR s.country ILIKE ${p} OR s.patronages ILIKE ${p}
        OR EXISTS (SELECT 1 FROM miracles m WHERE m.saint_id = s.id AND (m.title ILIKE ${p} OR m.description ILIKE ${p}))
        OR EXISTS (SELECT 1 FROM saint_tags st JOIN tags t ON t.id = st.tag_id WHERE st.saint_id = s.id AND t.name ILIKE ${p})
      )`);
    }
    if (name) where.push(`s.name ILIKE ${add(name)}`);
    if (origin) where.push(`(s.origin_place ILIKE ${add(origin)} OR s.country ILIKE $${values.length})`);
    if (miracle) {
      const p = add(miracle);
      where.push(`EXISTS (SELECT 1 FROM miracles m WHERE m.saint_id = s.id AND (m.title ILIKE ${p} OR m.description ILIKE ${p}))`);
    }
    if (tag) where.push(`EXISTS (SELECT 1 FROM saint_tags st JOIN tags t ON t.id = st.tag_id WHERE st.saint_id = s.id AND t.name ILIKE ${add(tag)})`);

    const result = await pool.query(`
      SELECT s.*,
        COALESCE((SELECT json_agg(json_build_object('id', m.id, 'title', m.title, 'description', m.description) ORDER BY m.id)
          FROM miracles m WHERE m.saint_id = s.id), '[]'::json) AS miracles,
        COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
          FROM saint_tags st JOIN tags t ON t.id = st.tag_id WHERE st.saint_id = s.id), '[]'::json) AS tags
      FROM saints s
      WHERE ${where.join(" AND ")}
      ORDER BY s.name ASC
      LIMIT 200
    `, values);
    res.json({ saints: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        COALESCE((SELECT json_agg(json_build_object('id', m.id, 'title', m.title, 'description', m.description) ORDER BY m.id)
          FROM miracles m WHERE m.saint_id = s.id), '[]'::json) AS miracles,
        COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
          FROM saint_tags st JOIN tags t ON t.id = st.tag_id WHERE st.saint_id = s.id), '[]'::json) AS tags
      FROM saints s WHERE s.id = $1 AND s.is_published = TRUE
    `, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "No encontramos ese santo." });
    res.json({ saint: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
