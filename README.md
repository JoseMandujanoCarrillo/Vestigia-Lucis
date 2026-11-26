# Vestigia Lucis API

API Express/PostgreSQL para Vestigia Lucis.

## Render

- Build: `npm install`
- Start: `npm start`
- Health check: `/api/health`

Configura `DATABASE_URL`, `JWT_SECRET`, `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `FRONTEND_ORIGIN` y `CLOUDINARY_URL`. El nombre y correo iniciales son José Carrillo y Admin@VestigiaLuce.com; define una contraseña nueva de al menos 12 caracteres como variable privada.

Configura en Render las variables privadas `SUPERADMIN_NAME=José Carrillo`, `SUPERADMIN_EMAIL=Admin@VestigiaLuce.com` y una contraseña nueva (`SUPERADMIN_PASSWORD`, mínimo 12 caracteres). Ejecuta ambos comandos desde Render Shell o desde un equipo conectado a la misma base de datos:

```bash
npm run db:init
npm run admin:create
```

`npm run db:init` migra el esquema existente. `npm run admin:create` crea o actualiza la cuenta principal y restablece su contraseña cada vez que se ejecuta. Desde el menú de la aplicación, cada administrador puede abrir **Mi cuenta y usuarios** para cambiar su contraseña. La cuenta principal también puede crear, editar y borrar cuentas administradoras; las demás cuentas no pueden gestionar usuarios. Cada creación o guardado de un santo cuenta como un aporte; los registros históricos conservan al creador original cuando existe.

En desarrollo, las imágenes se guardan en `uploads/`. En Render, configura `CLOUDINARY_URL` con la variable de entorno que proporciona Cloudinary para guardarlas de forma persistente; la base de datos guardará sus URL seguras. Mantén ese valor privado y fuera de GitHub. Las imágenes locales que ya estaban guardadas no se migran automáticamente: vuelve a subirlas desde Administración después de configurar Cloudinary.

Para una base Neon ya existente, la restricción de publicación debe actualizarse con el SQL de migración para aceptar entre una y tres imágenes. Cambiar `schema.sql` no modifica por sí solo las restricciones ya instaladas.
