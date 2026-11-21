import { useEffect, useMemo, useState } from "react";

const API = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://vestigia-lucis.onrender.com/api" : "http://localhost:4000/api")
).replace(/\/$/, "");
const API_ORIGIN = new URL(API).origin;
const mediaUrl = (url) => url?.startsWith("/") ? `${API_ORIGIN}${url}` : url;
const emptyForm = {
  name: "", short_description: "", biography: "", origin_place: "", country: "",
  birth_date: "", death_date: "", feast_day: "", patronages: "", youtube_url: "",
  miracles: "", tags: "", is_published: true
};

async function request(path, options = {}, token) {
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la solicitud.");
  return data;
}

function App() {
  const [saints, setSaints] = useState([]);
  const [filters, setFilters] = useState({ q: "", name: "", miracle: "", origin: "", tag: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("saints-theme") || "classic");
  const [token, setToken] = useState(() => localStorage.getItem("saints-admin-token") || "");
  const [adminSaints, setAdminSaints] = useState([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState([null, null, null]);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const query = useMemo(() => new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value.trim())
  ).toString(), [filters]);

  useEffect(() => {
    localStorage.setItem("saints-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!optionsOpen && !menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOptionsOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen, optionsOpen]);

  async function loadSaints() {
    setLoading(true);
    setError("");
    try {
      const data = await request(`/saints${query ? `?${query}` : ""}`);
      setSaints(data.saints);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminSaints() {
    if (!token) return;
    try {
      const data = await request("/admin/saints", {}, token);
      setAdminSaints(data.saints);
    } catch (e) {
      setAdminError(e.message);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadSaints, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (adminOpen && token) loadAdminSaints();
  }, [adminOpen, token]);

  async function login(event) {
    event.preventDefault();
    setAdminError("");
    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      });
      localStorage.setItem("saints-admin-token", data.token);
      setToken(data.token);
      setAdminPassword("");
    } catch (e) {
      setAdminError(e.message);
    }
  }

  function startEditing(saint) {
    setEditingId(String(saint.id));
    setForm({
      name: saint.name || "",
      short_description: saint.short_description || "",
      biography: saint.biography || "",
      origin_place: saint.origin_place || "",
      country: saint.country || "",
      birth_date: saint.birth_date?.slice(0, 10) || "",
      death_date: saint.death_date?.slice(0, 10) || "",
      feast_day: saint.feast_day || "",
      patronages: saint.patronages || "",
      youtube_url: saint.youtube_url || "",
      miracles: (saint.miracles || []).map((item) => item.title ? `${item.title}: ${item.description}` : item.description).join("\n"),
      tags: (saint.tags || []).map((item) => item.name).join(", "),
      is_published: saint.is_published
    });
    setImages([null, null, null]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveSaint(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setAdminError("");
    const body = new FormData();
    for (const [key, value] of Object.entries(form)) {
      if (key === "is_published") body.append(key, String(value));
      else body.append(key, value);
    }
    images.forEach((image, index) => {
      if (image) body.append(`image_${index + 1}`, image);
    });
    try {
      await request(editingId ? `/admin/saints/${editingId}` : "/admin/saints", {
        method: editingId ? "PUT" : "POST",
        body
      }, token);
      setNotice(editingId ? "Santo actualizado correctamente." : "Santo creado correctamente.");
      setForm(emptyForm);
      setImages([null, null, null]);
      setEditingId("");
      await loadSaints();
      await loadAdminSaints();
    } catch (e) {
      setAdminError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSaint(saint) {
    if (!window.confirm(`¿Eliminar a ${saint.name}? Esta acción no se puede deshacer.`)) return;
    try {
      await request(`/admin/saints/${saint.id}`, { method: "DELETE" }, token);
      setNotice("Santo eliminado.");
      await loadSaints();
      await loadAdminSaints();
    } catch (e) {
      setAdminError(e.message);
    }
  }

  function logout() {
    localStorage.removeItem("saints-admin-token");
    setToken("");
    setForm(emptyForm);
    setEditingId("");
  }

  return (
    <div className="app-shell" data-theme={theme}>
      {menuOpen && (
        <div className="menu-layer">
          <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />
          <aside className="menu-sidebar" role="dialog" aria-modal="true" aria-labelledby="menu-title">
            <div className="options-sidebar-heading">
              <div><p className="eyebrow">VESTIGIA LUCIS</p><h2 id="menu-title">Menú</h2></div>
              <button className="options-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">×</button>
            </div>
            <button className="options-toggle menu-options-button" onClick={() => { setMenuOpen(false); setOptionsOpen(true); }}>
              <span aria-hidden="true">⚙</span> Temas
            </button>
          </aside>
        </div>
      )}

      <div className="app-window">
        <header className="topbar">
          <div className="brand-group">
            <button className="hamburger-toggle" onClick={() => setMenuOpen(true)} aria-label="Abrir menú de opciones" aria-expanded={menuOpen}>
              <span /><span /><span />
            </button>
            <a className="brand" href="#" onClick={() => setSelected(null)} aria-label="Inicio">
              <span className="brand-mark" aria-hidden="true">✦</span><span className="brand-wordmark">Vestigia <b>Lucis</b></span>
            </a>
          </div>
          <nav className="topbar-actions" aria-label="Administración">
            <button className="admin-toggle" onClick={() => setAdminOpen(!adminOpen)}>
              {adminOpen ? "Cerrar administración" : "Administrar"}
            </button>
          </nav>
        </header>

        {optionsOpen && (
          <div className="options-layer">
            <button className="options-backdrop" onClick={() => setOptionsOpen(false)} aria-label="Cerrar opciones" />
            <aside className="options-sidebar" id="theme-options" role="dialog" aria-modal="true" aria-labelledby="options-title">
              <div className="options-sidebar-heading">
                <div><p className="eyebrow">PERSONALIZA TU VISITA</p><h2 id="options-title">Temas</h2></div>
                <button className="options-close" onClick={() => setOptionsOpen(false)} aria-label="Cerrar opciones">×</button>
              </div>
              <p className="options-description">Elige el aspecto que más te guste. Tu preferencia se guardará en este dispositivo.</p>
              <fieldset className="theme-choices">
                <legend>Estilo de la página</legend>
                <label className={`theme-choice ${theme === "classic" ? "selected" : ""}`}>
                  <input type="radio" name="theme" value="classic" checked={theme === "classic"} onChange={() => setTheme("classic")} />
                  <span className="theme-preview theme-preview-classic" aria-hidden="true"><span>✦</span><i /></span>
                  <span className="theme-choice-copy"><b>Estelar</b><small>Un cielo tranquilo con luces doradas.</small></span>
                  <span className="theme-check" aria-hidden="true">{theme === "classic" ? "✓" : ""}</span>
                </label>
                <label className={`theme-choice ${theme === "xp" ? "selected" : ""}`}>
                  <input type="radio" name="theme" value="xp" checked={theme === "xp"} onChange={() => setTheme("xp")} />
                  <span className="theme-preview theme-preview-xp" aria-hidden="true"><span>✦</span><i /></span>
                  <span className="theme-choice-copy"><b>Nostalgic Luna</b><small>Campo desenfocado, panel de vidrio, azul y verde.</small></span>
                  <span className="theme-check" aria-hidden="true">{theme === "xp" ? "✓" : ""}</span>
                </label>
                <label className={`theme-choice ${theme === "vista" ? "selected" : ""}`}>
                  <input type="radio" name="theme" value="vista" checked={theme === "vista"} onChange={() => setTheme("vista")} />
                  <span className="theme-preview theme-preview-vista" aria-hidden="true"><span>✦</span><i /></span>
                  <span className="theme-choice-copy"><b>Aero Glass</b><small>Vidrio azul, brillos y un aire luminoso.</small></span>
                  <span className="theme-check" aria-hidden="true">{theme === "vista" ? "✓" : ""}</span>
                </label>
              </fieldset>
              <div className="options-tip"><span aria-hidden="true">☀</span><p>El cambio de estilo se aplica al instante.</p></div>
            </aside>
          </div>
        )}

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow"><span aria-hidden="true">✦</span> RELATOS QUE ILUMINAN</p>
            <h1>Vestigia <em>Lucis</em></h1>
            <p className="hero-tagline">Huellas de luz, historias que inspiran.</p>
            <p className="hero-intro">Descubre vidas extraordinarias, milagros y valores en relatos para imaginar, aprender y compartir en familia.</p>
            <a className="hero-cta" href="#glosario">Explorar historias <span aria-hidden="true">↓</span></a>
            <p className="hero-family-note"><span aria-hidden="true">✦</span> Para pequeños y grandes exploradores</p>
          </div>
          <div className="hero-art" role="img" aria-label="Un cielo nocturno con estrellas y una luna creciente">
            <span className="hero-moon" />
            <span className="hero-star hero-star-a">✦</span>
            <span className="hero-star hero-star-b">✦</span>
            <span className="hero-star hero-star-c">✦</span>
            <span className="hero-star hero-star-d">✦</span>
            <span className="hero-star hero-star-e">✦</span>
            <span className="hero-star hero-star-f">✦</span>
            <div className="hero-hill hero-hill-back" />
            <div className="hero-hill hero-hill-front" />
            <div className="hero-art-label"><span aria-hidden="true">✦</span><p><strong>Cada vida</strong><small>una estrella que guía</small></p></div>
          </div>
        </section>

        {adminOpen && (
          <section className="admin-panel">
            {!token ? (
              <form className="login-form" onSubmit={login}>
                <div>
                  <p className="eyebrow">ACCESO RESTRINGIDO</p>
                  <h2>Administración</h2>
                  <p>Inicia sesión para publicar y editar historias.</p>
                </div>
                <label>Correo electrónico<input type="email" autoComplete="username" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required /></label>
                <label>Contraseña<input type="password" autoComplete="current-password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required /></label>
                <button className="button-primary" type="submit">Iniciar sesión</button>
                {adminError && <p className="form-error">{adminError}</p>}
              </form>
            ) : (
              <div>
                <div className="admin-heading">
                  <div><p className="eyebrow">PANEL DE CONTENIDO</p><h2>{editingId ? "Editar santo" : "Agregar un santo"}</h2></div>
                  <button className="button-quiet" onClick={logout}>Cerrar sesión</button>
                </div>
                <label className="admin-selector">Editar un santo existente
                  <select value={editingId} onChange={(e) => {
                    const saint = adminSaints.find((item) => String(item.id) === e.target.value);
                    if (saint) startEditing(saint);
                    else { setEditingId(""); setForm(emptyForm); setImages([null, null, null]); }
                  }}>
                    <option value="">Crear un santo nuevo</option>
                    {adminSaints.map((saint) => <option key={saint.id} value={saint.id}>{saint.name}{saint.is_published ? "" : " (borrador)"}</option>)}
                  </select>
                </label>
                <form className="saint-form" onSubmit={saveSaint}>
                  <label>Nombre *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength="180" /></label>
                  <label>Lugar de procedencia *<input value={form.origin_place} onChange={(e) => setForm({ ...form, origin_place: e.target.value })} required maxLength="180" /></label>
                  <label>País<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} maxLength="120" /></label>
                  <label>Día festivo<input value={form.feast_day} onChange={(e) => setForm({ ...form, feast_day: e.target.value })} placeholder="Ej. 4 de octubre" maxLength="100" /></label>
                  <label>Fecha de nacimiento<input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></label>
                  <label>Fecha de fallecimiento<input type="date" value={form.death_date} onChange={(e) => setForm({ ...form, death_date: e.target.value })} /></label>
                  <label className="span-two">Descripción breve *<textarea rows="2" value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} required maxLength="500" /></label>
                  <label className="span-two">Historia / biografía<textarea rows="5" value={form.biography} onChange={(e) => setForm({ ...form, biography: e.target.value })} /></label>
                  <label className="span-two">Milagros (uno por línea; opcionalmente “Título: descripción”)<textarea rows="4" value={form.miracles} onChange={(e) => setForm({ ...form, miracles: e.target.value })} /></label>
                  <label>Patronazgos<input value={form.patronages} onChange={(e) => setForm({ ...form, patronages: e.target.value })} placeholder="Separados por comas" /></label>
                  <label>Etiquetas<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Ej. caridad, educación" /></label>
                  <label className="span-two">URL de YouTube<input type="url" value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." /></label>
                  {[0, 1, 2].map((index) => (
                    <label key={index}>Imagen {index + 1}{!editingId && " *"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" required={!editingId && form.is_published} onChange={(e) => setImages(images.map((image, i) => i === index ? e.target.files?.[0] || null : image))} />
                    </label>
                  ))}
                  <label className="publish-option"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Publicar en el glosario</label>
                  <div className="form-actions span-two">
                    <button className="button-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear santo"}</button>
                    {editingId && <button className="button-quiet" type="button" onClick={() => { setEditingId(""); setForm(emptyForm); setImages([null, null, null]); }}>Cancelar edición</button>}
                    {editingId && <button className="button-danger" type="button" onClick={() => {
                      const saint = adminSaints.find((item) => String(item.id) === editingId);
                      if (saint) deleteSaint(saint);
                    }}>Eliminar santo</button>}
                    {notice && <span className="form-success">{notice}</span>}
                    {adminError && <span className="form-error">{adminError}</span>}
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {selected ? (
          <SaintDetail saint={selected} onBack={() => setSelected(null)} />
        ) : (
          <section className="directory" id="glosario">
            <div className="section-heading">
              <div><p className="eyebrow">EL GLOSARIO</p><h2>Historias para descubrir</h2></div>
              <span className="result-count">{loading ? "…" : `${saints.length} ${saints.length === 1 ? "historia" : "historias"}`}</span>
            </div>
            <div className="filters">
              <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Buscar en todo el glosario" placeholder="Buscar por nombre, milagro, lugar…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></label>
              <input aria-label="Filtrar por nombre" placeholder="Nombre del santo" value={filters.name} onChange={(e) => setFilters({ ...filters, name: e.target.value })} />
              <input aria-label="Filtrar por milagro" placeholder="Milagro" value={filters.miracle} onChange={(e) => setFilters({ ...filters, miracle: e.target.value })} />
              <input aria-label="Filtrar por procedencia" placeholder="Lugar de procedencia" value={filters.origin} onChange={(e) => setFilters({ ...filters, origin: e.target.value })} />
              <input aria-label="Filtrar por etiqueta" placeholder="Tema / etiqueta" value={filters.tag} onChange={(e) => setFilters({ ...filters, tag: e.target.value })} />
              <button className="clear-filters" onClick={() => setFilters({ q: "", name: "", miracle: "", origin: "", tag: "" })}>Limpiar</button>
            </div>
            {error ? <div className="empty-state"><h3>No se pudo cargar el glosario</h3><p>{error}</p></div> : loading ? <div className="empty-state">Cargando historias…</div> : saints.length ? (
              <div className="saint-grid">
                {saints.map((saint) => (
                  <article className="saint-card" key={saint.id}>
                    <button className="card-open" onClick={() => setSelected(saint)} aria-label={`Ver historia de ${saint.name}`}>
                      <div className="card-image"><img src={mediaUrl(saint.image_1_url)} alt={saint.name} loading="lazy" /><span className="image-count">✦ 3 imágenes</span></div>
                      <div className="card-content">
                        <p className="card-location">{saint.origin_place}{saint.country ? ` · ${saint.country}` : ""}</p>
                        <h3>{saint.name}</h3>
                        <p className="card-description">{saint.short_description}</p>
                        <span className="read-more">Conocer su historia <span aria-hidden="true">→</span></span>
                      </div>
                    </button>
                    {token && <div className="card-admin"><button onClick={() => { setAdminOpen(true); startEditing(saint); }}>Editar</button><button onClick={() => deleteSaint(saint)}>Eliminar</button></div>}
                  </article>
                ))}
              </div>
            ) : <div className="empty-state"><span className="empty-icon">✦</span><h3>No encontramos historias</h3><p>Prueba con otros términos o limpia los filtros.</p></div>}
          </section>
        )}
      </main>
      <footer><span className="brand-mark" aria-hidden="true">✦</span><strong>Vestigia Lucis</strong><span className="footer-note">Historias para compartir en familia</span></footer>
      </div>
    </div>
  );
}

function SaintDetail({ saint, onBack }) {
  const [activeImage, setActiveImage] = useState(0);
  const images = [saint.image_1_url, saint.image_2_url, saint.image_3_url].filter(Boolean).map(mediaUrl);
  const videoId = saint.youtube_url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1];
  return (
    <article className="detail-view">
      <button className="back-link" onClick={onBack}>← Volver al glosario</button>
      <div className="detail-header"><p className="eyebrow">{saint.origin_place}{saint.country ? ` · ${saint.country}` : ""}</p><h2>{saint.name}</h2><p>{saint.short_description}</p></div>
      {images.length > 0 && <div className="gallery">
        <img className="gallery-main" src={images[activeImage]} alt={`${saint.name}, imagen ${activeImage + 1}`} />
        <div className="gallery-thumbs">{images.map((image, index) => <button key={image} className={index === activeImage ? "active" : ""} onClick={() => setActiveImage(index)} aria-label={`Ver imagen ${index + 1}`}><img src={image} alt="" /></button>)}</div>
      </div>}
      <div className="detail-columns">
        <div className="detail-copy">
          <p className="eyebrow">SU HISTORIA</p><h3>Una vida que inspira</h3>
          <p className="biography">{saint.biography || saint.short_description}</p>
          {saint.miracles?.length > 0 && <><p className="eyebrow sub-eyebrow">MILAGROS</p><div className="miracle-list">{saint.miracles.map((miracle) => <section key={miracle.id}><h4>{miracle.title}</h4><p>{miracle.description}</p></section>)}</div></>}
          {saint.tags?.length > 0 && <div className="tag-list">{saint.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}</div>}
        </div>
        <aside className="detail-facts"><h3>Datos</h3>
          {saint.feast_day && <p><b>Festividad</b><span>{saint.feast_day}</span></p>}
          {saint.birth_date && <p><b>Nacimiento</b><span>{new Date(`${saint.birth_date.slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX")}</span></p>}
          {saint.death_date && <p><b>Fallecimiento</b><span>{new Date(`${saint.death_date.slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX")}</span></p>}
          {saint.patronages && <p><b>Patronazgos</b><span>{saint.patronages}</span></p>}
          <p><b>Procedencia</b><span>{saint.origin_place}{saint.country ? `, ${saint.country}` : ""}</span></p>
        </aside>
      </div>
      {videoId && <section className="video-section"><p className="eyebrow">PARA CONOCER MÁS</p><h3>La historia en video</h3><div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={`Video sobre ${saint.name}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div></section>}
    </article>
  );
}

export default App;
