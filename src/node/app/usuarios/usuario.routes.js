const express = require("express");
const router = express.Router();
const {crearUsuario, obtenerUsuarios,actualizarDataUsuario,obtenerDatoUsuario, actualizarUsuario, obtenerDataDeUsuario, obtenerEmpresas} = require("./usuario.controller");

router.get('/', obtenerUsuarios);
router.get('/data/usuario/:nombre', obtenerDataDeUsuario);
router.get('/info/usuario/:id', obtenerDatoUsuario);
router.get('/empresas', obtenerEmpresas);
router.post('/', crearUsuario);
router.put('/:id', actualizarUsuario);
router.put('/info/usuario/:id', actualizarDataUsuario);


module.exports = router;