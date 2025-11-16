// src/node/app/auth/auth.routes.js
const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { validarCampos } = require('../../core/middelware/validate.service');
const { login } = require('./auth.controller');

router.post('/',
  check('user', 'El usuario es requerido').not().isEmpty(),
  check('password', 'La contraseña es requerida').not().isEmpty(),
  validarCampos,
  login
);

module.exports = router;
