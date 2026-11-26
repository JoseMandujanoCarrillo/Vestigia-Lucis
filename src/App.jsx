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
  miracles: "", tags: "", is_published: false
};

async function request(path, options = {}, token) {
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "No se pudo completar la solicitud.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function saintSaveErrorMessage(error) {
  const message = error.message.toLowerCase();
  if (error.status === 413 || message.includes("file too large")) {
    return "No se pudo subir la imagen. Cada archivo debe pesar 5 MB o menos.";
  }
  if (error.status === 502) {
    return "No se pudieron guardar las imágenes. Revisa la conexión del servicio de almacenamiento e inténtalo de nuevo.";
  }
  if (!error.status) {
    return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  if (error.status >= 500) {
    return "El servidor tuvo un problema al guardar el santo. Inténtalo de nuevo más tarde.";
  }
  return error.message;
}

function App() {
  const [saints, setSaints] = useState([]);
  const [filters, setFilters] = useState({ q: "", name: "", miracle: "", origin: "", tag: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [accountPage, setAccountPage] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("saints-theme") || "classic");
  const [token, setToken] = useState(() => localStorage.getItem("saints-admin-token") || "");
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [adminSaints, setAdminSaints] = useState([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [saintSaveError, setSaintSaveError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState([null, null, null]);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  function handleAdminError(error) {
    if (error.status === 401) {
      localStorage.removeItem("saints-admin-token");
      setToken("");
      setCurrentAdmin(null);
      setAccountPage(false);
    }
    setAdminError(error.message);
  }

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
      handleAdminError(e);
    }
  }

  useEffect(() => {
    if (!token) {
      setCurrentAdmin(null);
      return undefined;
    }
    let active = true;
    request("/auth/me", {}, token).then((data) => {
      if (active) setCurrentAdmin(data.admin);
    }).catch((e) => {
      if (!active) return;
      handleAdminError(e);
    });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(loadSaints, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (adminOpen && token) loadAdminSaints();
  }, [adminOpen, token, currentAdmin]);

  async function login(event) {
    event.preventDefault();
    setAdminError("");
    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      });
      localStorage.setItem("saints-admin-token", data.token);
      setCurrentAdmin(data.admin);
      setToken(data.token);
      setAdminPassword("");
    } catch (e) {
      handleAdminError(e);
    }
  }

  function startEditing(saint) {
    setSaintSaveError("");
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
    if (!editingId && imageCount === 0) {
      setSaintSaveError("Selecciona al menos una imagen para guardar el santo.");
      return;
    }
    setSaving(true);
    setNotice("");
    setAdminError("");
    setSaintSaveError("");
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
      if (e.status === 401) handleAdminError(e);
      else setSaintSaveError(saintSaveErrorMessage(e));
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
      handleAdminError(e);
    }
  }

  function logout() {
    localStorage.removeItem("saints-admin-token");
    setToken("");
    setCurrentAdmin(null);
    setAccountPage(false);
    setForm(emptyForm);
    setEditingId("");
  }

  const editingSaint = adminSaints.find((saint) => String(saint.id) === editingId);
  const imageCount = images.reduce((count, image, index) => (
    image || editingSaint?.[`image_${index + 1}_url`] ? count + 1 : count
  ), 0);

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
            {token && currentAdmin && (
              <button className="options-toggle menu-options-button" onClick={() => { setMenuOpen(false); setAdminOpen(false); setAccountPage(true); }}>
                <span aria-hidden="true">♙</span> Mi cuenta
              </button>
            )}
          </aside>
        </div>
      )}

      <div className="app-window">
        <header className="topbar">
          <div className="brand-group">
            <button className="hamburger-toggle" onClick={() => setMenuOpen(true)} aria-label="Abrir menú de opciones" aria-expanded={menuOpen}>
              <span /><span /><span />
            </button>
            <a className="brand" href="#" onClick={() => { setSelected(null); setAccountPage(false); }} aria-label="Inicio">
              <span className="brand-mark" aria-hidden="true">✝</span><span className="brand-wordmark">Vestigia <b>Lucis</b></span>
            </a>
          </div>
          <nav className="topbar-actions" aria-label="Administración">
            <button className="admin-toggle" onClick={() => { setAccountPage(false); setAdminOpen(!adminOpen); }}>
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
        {accountPage && token && currentAdmin ? (
          <AccountPage
            token={token}
            currentAdmin={currentAdmin}
            onBack={() => setAccountPage(false)}
            onError={handleAdminError}
          />
        ) : <>
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
                  <div><p className="eyebrow">PANEL DE CONTENIDO</p><h2>{editingId ? "Editar santo" : "Agregar un santo"}</h2><p className="admin-welcome">Sesión: {currentAdmin?.name || currentAdmin?.email}</p></div>
                  <button className="button-quiet" onClick={logout}>Cerrar sesión</button>
                </div>
                {saintSaveError && <div className="form-error upload-error" role="alert"><strong>No se pudo guardar el santo</strong><span>{saintSaveError}</span></div>}
                <label className="admin-selector">Editar un santo existente
                  <select value={editingId} onChange={(e) => {
                    const saint = adminSaints.find((item) => String(item.id) === e.target.value);
                    if (saint) startEditing(saint);
                    else { setSaintSaveError(""); setEditingId(""); setForm(emptyForm); setImages([null, null, null]); }
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
                    <label key={index}>Imagen {index + 1} (opcional)
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
                        const nextImages = images.map((image, i) => i === index ? e.target.files?.[0] || null : image);
                        setImages(nextImages);
                        const count = nextImages.reduce((total, image, i) => (
                          image || editingSaint?.[`image_${i + 1}_url`] ? total + 1 : total
                        ), 0);
                        setForm((previousForm) => ({
                          ...previousForm,
                          is_published: count < 3 ? false : previousForm.is_published
                        }));
                        setSaintSaveError("");
                      }} />
                    </label>
                  ))}
                  <p className="image-upload-help span-two">
                    Imágenes seleccionadas: {imageCount} de 3. Puedes guardar con 1, 2 o 3; para publicar en el glosario se requieren las 3. Con menos de 3 se guardará como borrador.
                  </p>
                  <label className="publish-option"><input type="checkbox" checked={form.is_published} disabled={imageCount < 3} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Publicar en el glosario</label>
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
                    <ContributionSummary contributors={saint.contributors} />
                  </article>
                ))}
              </div>
            ) : <div className="empty-state"><span className="empty-icon">✦</span><h3>No encontramos historias</h3><p>Prueba con otros términos o limpia los filtros.</p></div>}
          </section>
        )}
        </>}
      </main>
      <footer><span className="brand-mark" aria-hidden="true">✝</span><strong>Vestigia Lucis</strong><span className="footer-note">Historias para compartir en familia</span></footer>
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
      <ContributionSummary contributors={saint.contributors} />
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

function AccountPage({ token, currentAdmin, onBack, onError }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function handleAccountError(requestError, isPasswordChange = false) {
    if (requestError.status === 401 &&
        !(isPasswordChange && requestError.message.toLowerCase().includes("contraseña actual"))) {
      onError(requestError);
      return;
    }
    setError(requestError.message);
  }

  async function loadAdmins() {
    setLoading(true);
    try {
      const data = await request("/admin/admins", {}, token);
      setAdmins(data.admins);
      setCanManageAdmins(true);
    } catch (requestError) {
      if (requestError.status === 403) {
        setCanManageAdmins(false);
        setAdmins([]);
        setError("Esta cuenta no tiene permisos de superadministrador. Si ya activaste ese rol en la base de datos, cierra sesión, vuelve a iniciar y confirma que Render esté conectado a esa misma base.");
      } else if (requestError.status === 404) {
        setError("La gestión de administradores aún no está disponible en el backend. Despliega la rama backend con el cambio más reciente en Render.");
      } else {
        handleAccountError(requestError);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, [token]);

  function beginEdit(admin) {
    setEditingId(String(admin.id));
    setForm({ name: admin.name, email: admin.email, password: "" });
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId("");
    setForm({ name: "", email: "", password: "" });
  }

  async function saveAdmin(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await request(editingId ? `/admin/admins/${editingId}` : "/admin/admins", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form)
      }, token);
      setMessage(editingId ? "Cuenta actualizada." : "Cuenta creada.");
      cancelEdit();
      await loadAdmins();
    } catch (requestError) {
      handleAccountError(requestError);
    }
  }

  async function deleteAdmin(admin) {
    if (!window.confirm(`¿Eliminar la cuenta de ${admin.name} (${admin.email})?`)) return;
    setError("");
    setMessage("");
    try {
      await request(`/admin/admins/${admin.id}`, { method: "DELETE" }, token);
      setMessage("Cuenta eliminada.");
      await loadAdmins();
    } catch (requestError) {
      handleAccountError(requestError);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await request("/auth/password", {
        method: "PUT",
        body: JSON.stringify(passwordForm)
      }, token);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setMessage(data.message);
    } catch (requestError) {
      handleAccountError(requestError, true);
    }
  }

  return (
    <section className="account-page">
      <button className="back-link" onClick={onBack}>← Volver al glosario</button>
      <header className="account-page-heading">
        <p className="eyebrow">MI CUENTA</p>
        <h1>Cuenta y seguridad</h1>
        <p>Sesión iniciada como <strong>{currentAdmin.name || currentAdmin.email}</strong></p>
      </header>
      <section className="password-account">
        <div><p className="eyebrow">SEGURIDAD</p><h2>Cambiar mi contraseña</h2><p className="account-page-help">Confirma tu contraseña actual y elige una nueva de al menos 12 caracteres.</p></div>
        <form className="password-account-form" onSubmit={changePassword}>
          <label>Contraseña actual<input type="password" autoComplete="current-password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required /></label>
          <label>Contraseña nueva (mínimo 12 caracteres)<input type="password" autoComplete="new-password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} minLength="12" required /></label>
          <label>Confirmar contraseña nueva<input type="password" autoComplete="new-password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} minLength="12" required /></label>
          <button className="button-primary" type="submit">Cambiar contraseña</button>
        </form>
      </section>
      {canManageAdmins && (
        <section className="admin-accounts">
          <div><p className="eyebrow">GESTIÓN DE ACCESOS</p><h2>Usuarios administradores</h2><p className="account-page-help">Solo la cuenta superadministradora puede administrar estos usuarios.</p></div>
          <form className="admin-account-form" onSubmit={saveAdmin}>
            <label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength="120" /></label>
            <label>Correo electrónico<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>{editingId ? "Nueva contraseña (opcional)" : "Contraseña (mínimo 12 caracteres)"}<input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={form.password || !editingId ? 12 : undefined} required={!editingId} /></label>
            <button className="button-primary" type="submit">{editingId ? "Guardar cambios" : "Crear usuario"}</button>
            {editingId && <button className="button-quiet" type="button" onClick={cancelEdit}>Cancelar</button>}
          </form>
          {loading ? <p>Cargando usuarios…</p> : (
            <ul className="admin-account-list">
              {admins.map((admin) => (
                <li key={admin.id}>
                  <strong>{admin.name}</strong><span>{admin.email}</span>
                  {admin.is_superadmin
                    ? <span>Superadministrador</span>
                    : <span className="admin-account-actions"><button type="button" onClick={() => beginEdit(admin)}>Editar</button><button type="button" onClick={() => deleteAdmin(admin)}>Borrar</button></span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}
    </section>
  );
}

function ContributionSummary({ contributors = [] }) {
  if (!contributors.length) return null;
  const maximum = Number(contributors[0].contributions);
  const leading = contributors.filter((contributor) => Number(contributor.contributions) === maximum);
  return (
    <div className="contribution-summary">
      <p><strong>Mayor aporte:</strong> {leading.map((contributor) => contributor.name).join(", ")} ({maximum} {maximum === 1 ? "aporte" : "aportes"})</p>
      <p><strong>Colaboraron:</strong> {contributors.map((contributor) => `${contributor.name} (${contributor.contributions})`).join(", ")}</p>
    </div>
  );
}

export default App;
