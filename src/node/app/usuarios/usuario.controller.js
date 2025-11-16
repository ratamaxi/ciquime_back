const pool = require('../../core/database/mysql-config.js');

const crearUsuario = async (req, res) => {
 try {
    const {
      nombre,
      password,
      rol_id,
      empresa_id,
      establecimiento_id,
      fecha_insert,
      mail,
      fabricante_id,
      rank,
      token_pass,
      version,
      accountNonExpired,
      accountNonLocked,
      credentialsNonExpired,
      enabled,
      pass_request,
      UFds,
      UFdsValid,
      UFdsUpdated
    } = req.body;

    const query = `
      INSERT INTO usuario (
        nombre, password, rol_id, empresa_id, establecimiento_id,
        fecha_insert, mail, fabricante_id, rank, token_pass, version,
        accountNonExpired, accountNonLocked, credentialsNonExpired,
        enabled, pass_request, UFds, UFdsValid, UFdsUpdated
      )
      VALUES (
        '${nombre}', '${password}', ${rol_id}, ${empresa_id}, ${establecimiento_id},
        '${fecha_insert}', '${mail}', ${fabricante_id}, ${rank}, '${token_pass}', ${version},
        ${accountNonExpired}, ${accountNonLocked}, ${credentialsNonExpired},
        ${enabled}, ${pass_request}, '${UFds}', '${UFdsValid}', '${UFdsUpdated}'
      )
    `;

    await pool.query(query);
    res.status(201).json({ ok: true, msg: 'Usuario insertado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al insertar el usuario' });
  }
};

const obtenerUsuarios = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT usuario.id, usuario.nombre, usuario.rol_id, usuario.mail, usuario.rank 
      FROM usuario
    `);
    res.json({
      ok: true,
      usuarios: rows
    });
  } catch (error) {
    console.error('Error en obtenerUsuarios:', error.message);
    res.status(500).json({ ok: false, mensaje: 'Error al obtener usuarios' });
  }
};

const actualizarUsuario = async (req, res) => {
  const {
    nombre,
    rol_id,
    empresa_id,
    establecimiento_id,
    fabricante_id,
    mail,
    rank,
    padre
  } = req.body;

  const { id } = req.params;

  const fecha_update = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const query = `
    UPDATE usuario SET
      nombre = ?,
      rol_id = ?,
      empresa_id = ?,
      establecimiento_id = ?,
      fabricante_id = ?,
      fecha_update = ?,
      mail = ?,
      rank = ?,
      padre = ?
    WHERE id = ?
  `;

  const values = [
    nombre,
    rol_id,
    empresa_id,
    establecimiento_id,
    fabricante_id,
    fecha_update,
    mail,
    rank,
    padre,
    id // Este es el WHERE
  ];

  try {
    const [result] = await pool.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }

    res.json({ ok: true, mensaje: 'Usuario actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor' });
  }
};

const obtenerDataDeUsuario = async (req, res) => {
  try {
    // toma el nombre desde params, query o body (en ese orden)
    let nombre =
      req.params?.nombre ??
      req.query?.nombre ??
      req.body?.nombre;

    if (!nombre || typeof nombre !== 'string') {
      return res.status(400).json({ error: 'Falta el parámetro "nombre"' });
    }

    // Query (sin exponer password)
    const sql = `
      SELECT
        u.nombre,
        u.alias,
        u.rol_id,
        u.id AS id_usuario,
        u.fabricante_id AS fabid,
        u.establecimiento_id,
        e.id AS id_empresa,
        e.razonSocial,
        u.rank,
        u.alias,
        u.vnro,
        e.contrato,
        u.region,
        e.plan
      FROM usuario u
      INNER JOIN empresa e ON u.empresa_id = e.id
      WHERE u.nombre = ?
      LIMIT 1
    `;

    const [rows] = await pool.execute(sql, [nombre]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Enviar el registro (sin password)
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error('obtenerDataDeUsuario error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

async function obtenerEmpresas(req, res) {
  try {
    const sql = `
      SELECT id, razonSocial AS noemp
      FROM empresa_tercero
      ORDER BY noemp ASC
    `;
    const [rows] = await pool.query(sql);

    // (Opcional) fix rápido de acentos mal decodificados
    const fix = (s) => { try { return decodeURIComponent(escape(s)); } catch { return s; } };
    const data = rows.map(r => ({ id: Number(r.id), noemp: fix(r.noemp) }));

    return res.json(data); // Array de { id, noemp }
  } catch (e) {
    console.error('obtenerEmpresas error:', e);
    return res.status(500).json({ ok: false, msj: 'Error obteniendo empresas' });
  }
}

const obtenerDatoUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (Number.isNaN(userId) || userId <= 0) {
      return res.status(400).json({ ok: false, message: 'id inválido' });
    }

    const sql = `
      SELECT
        u.nombre,
        u.password,   -- hash en DB
        u.mail,
        u.alias
      FROM usuario AS u
      WHERE u.id = ?
      LIMIT 1
    `;

    const [rows] = await pool.query(sql, [userId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    const row = rows[0];

    // Por seguridad, NO devolvemos el password (ni aunque sea hash).
    // Si lo necesitás para un flujo específico, descomenta bajo TU responsabilidad.
    const data = {
      id: userId,
      nombre: row.nombre,
      mail: row.mail,
      alias: row.alias,
      // passwordHash: row.password, // ⚠️ NO recomendado exponerlo
    };

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('Error en obtenerDatoUsuario:', err);
    return res.status(500).json({ ok: false, message: 'Error al obtener datos del usuario' });
  }
};

const actualizarDataUsuario = async (req, res) => {
try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (Number.isNaN(userId)) {
      return res.status(400).json({ ok: false, message: 'id inválido' });
    }

    let { mail, alias, password } = req.body || {};

    // Validaciones básicas
    if (!mail || typeof mail !== 'string') {
      return res.status(400).json({ ok: false, message: 'El mail es requerido' });
    }

    // Normalizo alias: si viene vacío lo mando como NULL
    if (alias !== undefined) {
      alias = (alias === '' ? null : alias);
    } else {
      alias = null; // si no lo envían, lo dejamos explícito en null para setearlo
    }

    // Si password viene vacío o undefined, no se actualiza
    const shouldUpdatePassword = typeof password === 'string' && password.trim() !== '';

    let sql;
    let params;

    if (shouldUpdatePassword) {
      // Con password
      sql = `UPDATE usuario SET password = ?, mail = ?, alias = ? WHERE id = ?`;
      params = [password, mail, alias, userId];
    } else {
      // Sin password
      sql = `UPDATE usuario SET mail = ?, alias = ? WHERE id = ?`;
      params = [mail, alias, userId];
    }

    const [result] = await pool.query(sql, params);

    // affectedRows = 0 puede ser porque no existe el usuario o porque no cambió nada
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado o sin cambios' });
    }

    return res.json({ ok: true, message: 'Usuario actualizado correctamente' });
  } catch (err) {
    console.error('Error en actualizarUsuario:', err);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el usuario' });
  }
}

module.exports = {
    crearUsuario,
    obtenerUsuarios,
    actualizarUsuario,
    obtenerDataDeUsuario,
    obtenerEmpresas,
    obtenerDatoUsuario,
    actualizarDataUsuario
};