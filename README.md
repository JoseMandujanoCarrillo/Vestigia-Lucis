# Vestigia Lucis API

API Express/PostgreSQL para Vestigia Lucis.

## Render

- Build: `npm install`
- Start: `npm start`
- Health check: `/api/health`

Configura `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_ORIGIN` y `CLOUDINARY_URL`.

Después del primer despliegue ejecuta:

```bash
npm run db:init
npm run admin:create
```

En desarrollo, las imágenes se guardan en `uploads/`. En Render, configura `CLOUDINARY_URL` con la variable de entorno que proporciona Cloudinary para guardarlas de forma persistente; la base de datos guardará sus URL seguras. Mantén ese valor privado y fuera de GitHub. Las imágenes locales que ya estaban guardadas no se migran automáticamente: vuelve a subirlas desde Administración después de configurar Cloudinary.
