# Vidas de Santos

Aplicación separada en una página React/Vite (`frontend/`) y un API Express (`backend/`), con PostgreSQL/Neon.

## Requisitos

- Node.js 18 o posterior.
- Una base PostgreSQL, por ejemplo Neon.

## Configuración

1. Copia `backend/.env.example` a `backend/.env` y configura `DATABASE_URL`, `JWT_SECRET` (mínimo 32 caracteres), `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 12 caracteres). Para guardar imágenes fuera del servidor, también configura `CLOUDINARY_URL`. No publiques el archivo `.env`.
2. Desde `backend/`, instala dependencias con `npm install`.
3. Inicializa las tablas con `npm run db:init`.
4. Crea o actualiza la cuenta administradora con `npm run admin:create`.
5. Inicia el API con `npm run dev`.
6. Copia `frontend/.env.example` a `frontend/.env`, instala dependencias desde `frontend/` con `npm install` e inicia la web con `npm run dev`.

La página se abre por defecto en `http://localhost:5173`; el API en `http://localhost:4000`. Sin `CLOUDINARY_URL`, las imágenes se guardan en `backend/uploads/` (útil en desarrollo). En Render, configura `CLOUDINARY_URL` como variable privada para guardar las imágenes en Cloudinary; la base de datos almacenará sus URL seguras. Las imágenes locales que ya estaban guardadas no se migran automáticamente: vuelve a subirlas desde Administración después de configurar Cloudinary.

## API

- `GET /api/health`: estado del API y conexión a la base.
- `POST /api/auth/login`: inicia sesión de administrador.
- `GET /api/saints`: glosario público. Admite `q`, `name`, `miracle`, `origin` y `tag`.
- `GET /api/saints/:id`: detalle público de un santo.
- `GET /api/admin/saints`: listado administrativo, incluidos borradores (token Bearer).
- `POST /api/admin/saints`: crea un santo (Bearer token y `multipart/form-data`).
- `PUT /api/admin/saints/:id`: actualiza un santo (Bearer token).
- `DELETE /api/admin/saints/:id`: elimina un santo (Bearer token).

Al crear un santo, envía `image_1`, `image_2` e `image_3` como archivos JPG, PNG o WebP (máximo 5 MB cada uno). Se pueden ingresar milagros, uno por línea; para especificar título, usa `Título: descripción`. Las etiquetas se separan por comas.
