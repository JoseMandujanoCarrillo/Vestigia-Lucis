# Vidas de Santos

Aplicación separada en una página React/Vite (`frontend/`) y un API Express (`backend/`), con PostgreSQL/Neon.

## Requisitos

- Node.js 18 o posterior.
- Una base PostgreSQL, por ejemplo Neon.

## Configuración

1. Copia `backend/.env.example` a `backend/.env` y configura `DATABASE_URL`, `JWT_SECRET` (mínimo 32 caracteres), `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` (mínimo 12 caracteres). El ejemplo incluye el nombre y correo de la cuenta principal; define una contraseña nueva y privada. Para guardar imágenes fuera del servidor, también configura `CLOUDINARY_URL`. No publiques el archivo `.env`.
2. Desde `backend/`, instala dependencias con `npm install`.
3. Inicializa o migra las tablas con `npm run db:init`.
4. Crea la cuenta principal con `npm run admin:create`. Este comando actualiza su contraseña cada vez que se ejecuta; úsalo solo al crear la cuenta o al cambiarla intencionalmente.
5. Inicia el API con `npm run dev`.
6. Copia `frontend/.env.example` a `frontend/.env`, instala dependencias desde `frontend/` con `npm install` e inicia la web con `npm run dev`.

La página se abre por defecto en `http://localhost:5173`; el API en `http://localhost:4000`. Sin `CLOUDINARY_URL`, las imágenes se guardan en `backend/uploads/` (útil en desarrollo). En Render, configura `CLOUDINARY_URL` como variable privada para guardar las imágenes en Cloudinary; la base de datos almacenará sus URL seguras. Las imágenes locales que ya estaban guardadas no se migran automáticamente: vuelve a subirlas desde Administración después de configurar Cloudinary.

La cuenta principal puede crear otras cuentas administradoras desde el panel; esas cuentas no pueden crear más administradores. En producción, configura `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL` y una contraseña nueva como variables privadas en Render y ejecuta `npm run db:init` y luego `npm run admin:create` desde el backend conectado a la base de datos. No uses la contraseña compartida anteriormente.

La migración añade el nombre y rol de administradores y el historial de aportes. Cada creación o guardado de un santo cuenta como un aporte; los registros históricos conservan el creador original cuando existe. No necesitas reemplazar manualmente el esquema anterior: basta con ejecutar `npm run db:init`.

## API

- `GET /api/health`: estado del API y conexión a la base.
- `POST /api/auth/login`: inicia sesión de administrador.
- `GET /api/auth/me`: devuelve el perfil de la sesión.
- `GET /api/saints`: glosario público. Admite `q`, `name`, `miracle`, `origin` y `tag`.
- `GET /api/saints/:id`: detalle público de un santo.
- `GET /api/admin/saints`: listado administrativo, incluidos borradores (token Bearer).
- `POST /api/admin/saints`: crea un santo (Bearer token y `multipart/form-data`).
- `PUT /api/admin/saints/:id`: actualiza un santo (Bearer token).
- `DELETE /api/admin/saints/:id`: elimina un santo (Bearer token).
- `GET /api/admin/admins`, `POST /api/admin/admins`, `PUT /api/admin/admins/:id` y `DELETE /api/admin/admins/:id`: gestión de cuentas, restringida a la cuenta principal.
- `PUT /api/auth/password`: cambio de contraseña del administrador autenticado.

Al crear un santo, envía de una a tres imágenes `image_1`, `image_2` e `image_3` como archivos JPG, PNG o WebP (máximo 5 MB cada uno). Sin modificar la base de datos, los santos con menos de tres imágenes se guardan como borradores, ya que el esquema actual exige tres imágenes para publicar. Se pueden ingresar milagros, uno por línea; para especificar título, usa `Título: descripción`. Las etiquetas se separan por comas.
