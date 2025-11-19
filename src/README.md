# CIQUIME Backend

API de Node.js y Express para la plataforma de seguros CIQUIME. Expone endpoints para autenticación con JWT, gestión de usuarios y registros, descarga de archivos y utilidades comunes.

## Requisitos previos
- [Node.js](https://nodejs.org/) 18 o superior
- npm
- Base de datos MySQL accesible con las credenciales configuradas en `src/node/core/database/mysql-config.js`

## Instalación
1. Clonar el repositorio.
2. Instalar dependencias:
   ```bash
   npm install
   ```

## Variables de entorno
El servidor carga el archivo de entorno desde `src/resources/.env.development` (o `.env.production` si `NODE_ENV=production`). Creá el archivo que corresponda con al menos estas variables:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=clave_de_firmado
JWT_REFRESH_SECRET=clave_refresh
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
# Campo de contraseña en la tabla usuario (opcional)
DB_USER_PASSWORD_FIELD=password
```

> Ajustá host, usuario y contraseña en `src/node/core/database/mysql-config.js` si tu base de datos es distinta de la configuración por defecto. 

## Ejecución
- Desarrollo:
  ```bash
  npm run start:dev
  ```
- Testing (modo `NODE_ENV=testing`):
  ```bash
  npm run start:test
  ```
- Producción:
  ```bash
  npm run start:prod
  ```

El servidor expone las rutas bajo `/api` y escucha en el puerto definido por `PORT` (3000 por defecto).

## Rutas principales
- `POST /api/auth` – inicio de sesión de usuarios.
- `POST /api/auth/refresh` – renovación de tokens JWT.
- `GET /api/usuario` – gestión de usuarios.
- `GET /api/registros` – operaciones sobre registros de seguimiento.
- `GET /api/descargas` – endpoints para descargas de archivos.
- `GET /api/utils` – utilidades varias.

> Algunas rutas requieren un header `Authorization: Bearer <token>` válido. El middleware de validación y refresco de tokens se define en `src/node/core/jwt/jwt.js`.

## Despliegue en Vercel
El archivo `vercel.json` ya incluye la configuración para desplegar la API en Vercel con `index.js` como entrypoint. Simplemente subí el proyecto y Vercel construirá el servicio sin pasos adicionales.

## Scripts disponibles
- `npm run start:dev` – inicia el servidor con nodemon en modo desarrollo.
- `npm run start:test` – inicia el servidor con nodemon en modo testing.
- `npm run start:prod` – inicia el servidor con nodemon en modo producción.

## Licencia
ISC
