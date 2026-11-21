# Despliegue

Este repositorio usa tres ramas:

- `main`: proyecto completo de desarrollo.
- `backend`: solo el API, preparado para Render.
- `frontend`: solo la web, preparada para Vercel.

## Render

1. Crea una base PostgreSQL y conserva su URL de conexión.
2. En Render, selecciona **New > Blueprint** y usa la rama `backend`.
3. Si no usas Blueprint, crea un **Web Service** con:
   - Root Directory: `/`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
4. Configura estas variables de entorno:
   - `DATABASE_URL`: URL PostgreSQL con SSL.
   - `JWT_SECRET`: secreto aleatorio de al menos 32 caracteres.
   - `ADMIN_EMAIL`: correo del administrador.
   - `ADMIN_PASSWORD`: contraseña fuerte del administrador.
   - `FRONTEND_ORIGIN`: `https://vestigia-lucis.vercel.app`. Para varios dominios, sepáralos por comas.
5. Abre el Shell de Render y ejecuta `npm run db:init`, seguido de `npm run admin:create`.
6. Verifica `https://TU-SERVICIO.onrender.com/api/health`.

El sistema de archivos de Render no es persistente. Las imágenes administrativas requieren un almacenamiento persistente externo o Render Disk.

## Vercel

1. Importa el repositorio en Vercel y selecciona la rama `frontend`. Si usas `main`, establece Root Directory en `frontend`.
2. Configura:
   - Framework Preset: `Vite`
   - Root Directory: `/` en la rama `frontend`, o `frontend` en `main`.
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. La URL del API está configurada en `frontend/.env.production` como `https://vestigia-lucis.onrender.com/api`.
4. Despliega o vuelve a desplegar el frontend.
5. Si cambias el dominio de Vercel, actualiza `FRONTEND_ORIGIN` en Render con la URL nueva y vuelve a desplegar el API.
