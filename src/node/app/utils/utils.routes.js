// src/node/app/utils/utils.routes.js
const express = require('express');
const router = express.Router();

const {
  redirectHSO,
  redirectFET,
  redirectFDS,      
  getEncryptedId,  
} = require('./utils.controller');

// ---------- Rutas Legacy: redirecciones ----------

// Abre HSO (hs.php?id=...)
router.get('/legacy/hs/:materiaId', redirectHSO);

// Abre FET (fie.php?id=...)
router.get('/legacy/fet/:materiaId', redirectFET);

// (Opcional) Redirigir FDS por el backend
router.get('/legacy/fds', redirectFDS);

// (Opcional) Obtener id_encrypt (útil para debug)
router.get('/legacy/encrypt/:materiaId', getEncryptedId);

module.exports = router;
