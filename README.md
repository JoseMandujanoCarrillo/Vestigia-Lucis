# Vestigia Lucis API

API Express/PostgreSQL para Vestigia Lucis.

## Render

- Build: `npm install`
- Start: `npm start`
- Health check: `/api/health`

Configura `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `FRONTEND_ORIGIN`.

Después del primer despliegue ejecuta:

```bash
npm run db:init
npm run admin:create
```

Las imágenes usan `uploads/`, cuyo almacenamiento local no persiste en Render. Usa almacenamiento persistente o externo para producción.
