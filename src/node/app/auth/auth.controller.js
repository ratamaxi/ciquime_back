const { response } = require('express');
const { generarToken } = require('../../core/jwt/jwt');
const { v4: uuidv4 } = require('uuid');
const { loginPorNombre } = require('./auth.service');

const login = async (req, res = response) => {
  try {
    const { user, password } = req.body; // tu body original

    const usuario = await loginPorNombre(user, password);
    if (!usuario) {
      return res.status(401).json({
        ok: false,
        msj: 'Credenciales inválidas',
        sessionTimeout: new Date(),
        version: null,
        sessionId: null,
        auth: null
      });
    }

    const uid = String(usuario.id_usuario);
    const email = usuario.mail || usuario.email || '';
    const id_empresa = usuario.id_empresa || '';

    const { token, refreshToken } = generarToken(uid, email, id_empresa);

    return res.json({
      ok: true,
      msj: 'Usuario autenticado exitosamente',
      sessionTimeout: new Date(),
      version: process.env.VERSION,
      sessionId: uuidv4(),
      auth: {
        token,
        refreshToken,
        accessToken: 'Bearer'
      },
      // Si querés devolver datos del usuario:
      // user: usuario
    });
  } catch (err) {
    console.error('ERROR login:', err);
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({
        ok: false,
        msj: 'Error interno',
        detail: { code: err.code, sqlMessage: err.sqlMessage, name: err.name }
      });
    }
    return res.status(500).json({
      ok: false,
      msj: 'Error interno',
      sessionTimeout: new Date(),
      version: process.env.VERSION,
      sessionId: null,
      auth: null
    });
  }
};

module.exports = { login };
