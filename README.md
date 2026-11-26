# Vestigia Lucis Frontend

Aplicación React/Vite para Vestigia Lucis.

## Vercel

- Framework: Vite
- Build: `npm run build`
- Output: `dist`

La API de producción ya está configurada en `.env.production`. Vercel la incluirá al compilar.

El formulario permite guardar santos con una, dos o tres imágenes sin cambiar el esquema de la base de datos. Para mantener la regla actual de Neon, un santo con menos de tres imágenes se guarda como borrador; para publicarlo en el glosario se requieren las tres.
