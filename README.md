# Vestigia Lucis Frontend

Aplicación React/Vite para Vestigia Lucis.

## Vercel

- Framework: Vite
- Build: `npm run build`
- Output: `dist`

La API de producción ya está configurada en `.env.production`. Vercel la incluirá al compilar.

El formulario publica automáticamente santos con una, dos o tres imágenes usando las columnas existentes. En una base Neon ya creada, actualiza la restricción de publicación con el SQL de migración correspondiente; no se agregan columnas.
