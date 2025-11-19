const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const { resolve } = require('node:path');
const pool = require('./src/node/core/database/mysql-config.js');

// Cargar variables de entorno
dotenv.config({
  path: resolve(
    __dirname,
    'src',
    'resources',
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env.development'
  )
});

const app = express();

// CORS
const allowedOrigins = [
  'http://localhost:4200',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Middlewares
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));

// Rutas
app.use('/api/usuario', require('./src/node/app/usuarios/usuario.routes'));
app.use('/api/registros', require('./src/node/app/registros/registros.routes.js'));
app.use('/api/auth', require('./src/node/app/auth/auth.routes'));
app.use('/api/descargas', require('./src/node/app/descargas/descargas.routes'));
app.use('/api/utils', require('./src/node/app/utils/utils.routes'));

// Servidor
pool.query('SELECT 1').then(()=>console.log('DB ok')).catch(e=>console.error('DB fail', e));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor en puerto ${PORT} | Modo: ${process.env.NODE_ENV}`);
});
