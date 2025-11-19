const pool = require('../../core/database/mysql-config.js');
const { response } = require('express');
const path = require('path');
const fs = require("fs");

const obtenerMateriasPrimas = async (req, res) => {
  try {
    const idUsuario =
      Number(req.params?.idUsuario ?? req.query?.idUsuario ?? req.body?.idUsuario ?? 0);
    const dias = 20

    if (!Number.isFinite(idUsuario)) {
      return res.status(400).json({ error: 'idUsuario inválido' });
    }
    if (!Number.isFinite(dias) || dias < 0) {
      return res.status(400).json({ error: 'dias inválido' });
    }

        const sql = `
SELECT materias_primas.id, materias_primas.nombre_producto, empresa_tercero.razonSocial AS nomb_empresa, materia_empresa.estado, materia_empresa.actualizado
FROM materia_empresa
INNER JOIN materias_primas ON materia_empresa.materia_id = materias_primas.id
INNER JOIN empresa_tercero on materias_primas.fabricante = empresa_tercero.id
WHERE usuario_id = ? AND ABS(DATEDIFF(NOW(), actualizado)) <= 20
`;

    const [rows] = await pool.execute(sql, [idUsuario]);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('obtenerMateriasPrimas error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const obtenerEstadisticaInsumo = async (req, res) => {
  const idUsuario = Number(req.params.idUsuario);
  if (!idUsuario) return res.status(400).json({ error: 'idUsuario es requerido' });

  try {
    const [rows] = await pool.query(
      `
      SELECT me.estado AS estado, COUNT(*) AS total
      FROM materia_empresa me
      JOIN materias_primas mp    ON mp.id = me.materia_id
      JOIN empresa_tercero et    ON mp.fabricante = et.id
      JOIN fds_dir fd            ON mp.id = fd.insumo_id AND fd.fds_fundamental = 1
      WHERE me.usuario_id = ?
        AND me.estado IN ('APROBADO','PENDIENTE','RECHAZADO')
      GROUP BY me.estado
      `,
      [idUsuario]
    );

    // Normalizamos salida
    let aprobados = 0, pendientes = 0, rechazados = 0;
    (rows).forEach(r => {
      if (r.estado === 'APROBADO')  aprobados = Number(r.total) || 0;
      if (r.estado === 'PENDIENTE') pendientes = Number(r.total) || 0;
      if (r.estado === 'RECHAZADO') rechazados = Number(r.total) || 0;
    });

    res.json({ aprobados, pendientes, rechazados });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error consultando conteos' });
  }
}

const obtenerRegistrosInsumo = async (req, res) => {
  try {
    const idUsuarioRaw = req.params.idUsuario;
    const idUsuario = Number(idUsuarioRaw);
    if (!idUsuario || Number.isNaN(idUsuario)) {
      return res.status(400).json({ error: 'idUsuario inválido' });
    }
    const insumo = (req.query.insumo) ?? '';
    const fabricante = (req.query.fabricante) ?? '';
    const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const sql = `
      SELECT
        fd.Nfile_name,
        mp.id                AS id,
        mp.fabricante        AS matid,
        et.id                AS empid,
        mp.nombre_producto   AS nombre_producto,
        et.razonSocial       AS fabricante,
        fd.FDS_rev           AS revisionFDS,
        fd.FDS_fecha         AS fecha_insert
      FROM materias_primas mp
      INNER JOIN fds_dir fd
        ON mp.id = fd.insumo_id
      INNER JOIN empresa_tercero et
        ON mp.fabricante = et.id
      WHERE mp.visual != 'Privado'
        AND fd.fds_fundamental = 1
        AND mp.estatus = 'Finalizada'
        AND mp.estado2 = 'ACTIVO'
        AND mp.id NOT IN (
          SELECT materia_id
          FROM materia_empresa
          WHERE usuario_id = ?
        )
        AND mp.nombre_producto LIKE ?
        AND et.razonSocial LIKE ?
      ORDER BY mp.id DESC
      LIMIT ? OFFSET ?
    `;

    const params = [
      idUsuario,
      `%${insumo}%`,
      `%${fabricante}%`,
      limit,
      offset,
    ];

    const [rows] = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error('obtenerRegistrosInsumo error:', err);
    return res.status(500).json({ error: 'Error consultando registros' });
  }
};

const FDS_DIR = process.env.FDS_DIR || (
  process.platform === 'win32'
    ? 'C:\\wamp\\www\\CIQUIME\\PDF\\fds_temporal'
    : '/var/www/CIQUIME/PDF/fds_temporal'
);

const insertarInsumos = async (req, res) => {
  try {
    const { idUsuario } = req.params;

    let {
      nombre,
      fabricante,
      revisionFDS,
      fechaFDS,
      visual,
      sector,
      procesado,
      api,
      id_usuario,
      id_empresa,
      AD,
    } = req.body || {};

    if (!id_usuario && idUsuario) id_usuario = idUsuario;

    // archivo subido por multer
    const f = req.file;
    if (!f) {
      return res.status(400).json({
        ok: false,
        msj: 'PDF obligatorio',
        detail: 'archivoFds ausente'
      });
    }

    // nombre “seguro”
    const originalName = f.originalname || f.filename || 'archivo.pdf';
    const safeName = path.basename(originalName).replace(/[\/\\:?*"<>|]/g, '_');

    // asegurar carpeta destino
    await fs.promises.mkdir(FDS_DIR, { recursive: true });

    // mover de /tmp de multer a FDS_DIR
    const finalPath = path.join(FDS_DIR, safeName);
    await fs.promises.rename(f.path, finalPath);

    // normalizar a slashes (como guardaba PHP)
    const finalPathForDb = finalPath.replace(/\\/g, '/');

    // validaciones mínimas
    const faltantes = [];
    if (!nombre) faltantes.push('nombre');
    if (!fabricante) faltantes.push('fabricante');
    if (!id_usuario) faltantes.push('id_usuario');
    if (!id_empresa) faltantes.push('id_empresa');

    if (faltantes.length) {
      return res.status(400).json({
        ok: false,
        msj: 'Faltan campos obligatorios',
        detail: faltantes.join(', ')
      });
    }

    const sql = `
      INSERT INTO materias_temporal
        (insumo, fabricante, rev_fds, fecha_fds, name_fds, dir_fds, visual,
         insumo_sector, procesado, insumo_api, user_id, empresa_id, registro)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const params = [
      nombre,
      fabricante,
      revisionFDS ?? null,
      normalizeFecha(fechaFDS),
      safeName,                   
      finalPathForDb,             
      toTinyInt(visual, 0),
      sector ?? null,
      toTinyInt(procesado, 0),
      toTinyInt(api, 0),
      id_usuario,
      id_empresa,
      AD ?? null,
    ];

    const [result] = await pool.execute(sql, params);

    return res.status(201).json({
      ok: true,
      msj: 'Insertado correctamente',
      id: result.insertId,
      affectedRows: result.affectedRows,
      name_fds: safeName,
      dir_fds: finalPathForDb,
    });
  } catch (err) {
    console.error('insertarInsumos error:', err, 'req.file =', req.file);
    return res.status(500).json({
      ok: false,
      msj: 'Error interno al insertar',
      detail: err.message || String(err),
    });
  }
};

const verEditarInsumo = async (req, res = response) => {
  try {
    const { idUsuario, estado } = req.params;

    // Validación simple del parámetro
    if (!/^\d+$/.test(idUsuario)) {
      return res.status(400).json({ ok: false, msg: 'idUsuario inválido' });
    }

    const sql = `
      SELECT
        me.materia_id,
        mp.nombre_producto,
        et.razonSocial,
        fd.FDS_fecha,
        fd.Nfile_name AS fds,
        me.extraname,
        me.apr_code,
        me.nombre_calidoc
      FROM materia_empresa AS me
      INNER JOIN materias_primas AS mp ON mp.id = me.materia_id
      INNER JOIN empresa_tercero AS et ON mp.fabricante = et.id
      INNER JOIN fds_dir AS fd ON mp.id = fd.insumo_id
      WHERE me.estado = ?
      AND me.usuario_id = ?
      AND fd.fds_fundamental = 1
      ORDER BY mp.nombre_producto ASC, fd.FDS_fecha DESC
    `;

    const [rows] = await pool.query(sql, [estado,Number(idUsuario)]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: true, data: [], msg: 'Sin resultados' });
    }

    return res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error en verEditarInsumo:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error al obtener insumos',
      error: error.message,
    });
  }
};
const toTinyInt = (v, def = 0) =>
  v === undefined || v === null ? def : (v === true ? 1 : (v === false ? 0 : Number(v)));

const normalizeFecha = (f) => {
  if (!f) return null;
  if (f instanceof Date && !isNaN(f)) {
    // YYYY-MM-DD desde Date
    const pad = (n) => String(n).padStart(2, '0');
    return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(f)) {
    const [dd, mm, yyyy] = f.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return f; 
};

const eliminarInsumo = async (req, res) => {
  try {
    let {
      matempresa,
      empresa_id,
      usuario_id,
    } = req.body || {};

    const materia_id = matempresa ?? req.body?.materia_id ?? req.body?.id;
    const faltan = [];
    if (!materia_id) faltan.push('matempresa (materia_id)');
    if (!empresa_id) faltan.push('empresa_id');
    if (!usuario_id) faltan.push('usuario_id');

    if (faltan.length) {
      return res.status(400).json({
        ok: false,
        msj: 'Faltan campos obligatorios',
        detail: faltan.join(', ')
      });
    }

    const sql = `
      UPDATE materia_empresa
         SET estado = 'ELIMINADO',
             actualizado = CURDATE()
       WHERE materia_id = ?
         AND empresa_id = ?
         AND usuario_id = ?
       LIMIT 1
    `;
    const params = [materia_id, empresa_id, usuario_id];

    const [result] = await pool.execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        msj: 'No se encontró el insumo para ese usuario/empresa',
        detail: { materia_id, empresa_id, usuario_id }
      });
    }

    return res.status(200).json({
      ok: true,
      msj: 'Insumo marcado como ELIMINADO',
      affectedRows: result.affectedRows,
      materia_id,
      empresa_id,
      usuario_id,
    });
  } catch (err) {
    console.error('eliminarInsumo error:', err);
    return res.status(500).json({
      ok: false,
      msj: 'Error interno al eliminar',
      detail: err.message || String(err),
    });
  }
};

const obtenerDataEditarInsumo = async (req, res) => {
 try {
    let { matempresa, empresa_id, usuario_id } = req.params;

    if (!matempresa) faltan.push('matempresa');
    if (!empresa_id) faltan.push('empresa_id');
    if (!usuario_id) faltan.push('usuario_id');

    // 1) Datos del insumo (materia_empresa) para rellenar el formulario
    const [insumoRows] = await pool.execute(
      `SELECT extraname, presentacion, requiere, nombre_calidoc, fechacalidad, aviso,
              sector, lote, estado, nota, nota_adm, apr_code, api, actualizado
         FROM materia_empresa
        WHERE materia_id = ?
          AND empresa_id = ?
          AND usuario_id = ?
        LIMIT 1`,
      [matempresa, empresa_id, usuario_id]
    );
    if (insumoRows.length === 0) {
      return res.status(404).json({
        ok: false,
        msj: 'No se encontró el insumo para ese usuario/empresa',
        detail: { materia_id, empresa_id, usuario_id }
      });
    }
    const insumo = insumoRows[0];

    // 2) Datos “descriptivos” del producto (como en tu PHP)
    const [prodRows] = await pool.execute(
      `SELECT mp.nombre_producto, mp.RNPQ, et.razonSocial AS fabricante
         FROM materias_primas mp
         JOIN empresa_tercero et ON mp.fabricante = et.id
        WHERE mp.id = ?
        LIMIT 1`,
      [matempresa]
    );
    const producto = prodRows[0] || null;

    return res.status(200).json({
      ok: true,
      msj: 'Datos para edición',
      insumo,    
      producto,
      keys: { matempresa, empresa_id, usuario_id }
    });
  } catch (err) {
    console.error('obtenerInsumoParaEdicion error:', err);
    return res.status(500).json({
      ok: false,
      msj: 'Error interno al consultar',
      detail: err.message || String(err),
    });
  }
};

const obtenerDataSectorInsumo = async (req, res) => {
  try {
    const { empresa_id } = req.params;
    const Eid = parseInt(empresa_id, 10);

    if (Number.isNaN(Eid)) {
      return res.status(400).json({ ok: false, message: 'empresa_id inválido' });
    }

    const sql = `
      SELECT sector AS emps
      FROM sector_emp
      WHERE empid IN (8, ?)
      ORDER BY sector ASC
    `;

    // mysql2/promise devuelve [rows, fields]
    const [rows] = await pool.query(sql, [Eid]);

    return res.json({
      ok: true,
      data: rows, 
    });
  } catch (err) {
    console.error('Error en obtenerDataSectorInsumo:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener sectores',
    });
  }
};

const modificarInsumo = async (req, res) => {
  const { idUsuario } = req.params;
  const {
    materia_id,        
    extraname = null,
    presentacion = null,
    sector = null,
    lote = null,
    nota = null,
  } = req.body || {};

  // Validaciones básicas
  if (!/^\d+$/.test(String(idUsuario))) {
    return res.status(400).json({ ok: false, message: 'idUsuario inválido' });
  }
  if (!/^\d+$/.test(String(materia_id))) {
    return res.status(400).json({ ok: false, message: 'materia_id inválido' });
  }

  try {
    const sql = `
      UPDATE materia_empresa
      SET
        extraname    = ?,
        presentacion = ?,
        sector       = ?,
        lote         = ?,
        nota         = ?,
        actualizado  = NOW()
      WHERE materia_id = ? AND usuario_id = ?
    `;
    const params = [
      extraname, presentacion, sector, lote, nota,
      Number(materia_id), Number(idUsuario)
    ];

    const [result] = await pool.query(sql, params);

    return res.json({
      ok: true,
      affectedRows: result?.affectedRows ?? 0,
      materia_id: Number(materia_id),
      usuario_id: Number(idUsuario),
    });
  } catch (err) {
    console.error('[modificarInsumo] error:', err);
    return res.status(500).json({ ok: false, message: 'Error al actualizar el insumo' });
  }
};

const agregarItemAUsuario = async (req, res) => {
  try {
    const { empresa, materia, usuario } = req.body;

    // Validaciones básicas
    const empresaId = parseInt(empresa, 10);
    const materiaId = parseInt(materia, 10);
    const usuarioId = parseInt(usuario, 10);

    if (
      Number.isNaN(empresaId) ||
      Number.isNaN(materiaId) ||
      Number.isNaN(usuarioId)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'Parámetros inválidos: empresa, materia y usuario deben ser numéricos',
      });
    }

    // fecha_update: ahora (YYYY-MM-DD HH:MM:SS) — también podrías usar NOW() en SQL
    const fechaUpdate = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fechaSql = `${fechaUpdate.getFullYear()}-${pad(fechaUpdate.getMonth() + 1)}-${pad(fechaUpdate.getDate())} ${pad(fechaUpdate.getHours())}:${pad(fechaUpdate.getMinutes())}:${pad(fechaUpdate.getSeconds())}`;

    const sql = `
      INSERT INTO materia_empresa
        (empresa_id, materia_id, usuario_id, registrado, api)
      VALUES (?, ?, ?, ?, '0')
    `;

    const params = [empresaId, materiaId, usuarioId, fechaSql];

    const [result] = await pool.query(sql, params);

    return res.status(201).json({
      ok: true,
      message: 'Insumo vinculado al usuario correctamente',
      insertId: result?.insertId ?? null,
    });
  } catch (err) {
    // Si tenés una restricción única y se intenta duplicar, MySQL lanza ER_DUP_ENTRY
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        message: 'El registro ya existe para ese usuario/empresa/materia',
      });
    }
    console.error('Error en agregarItemAUsuario:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al vincular el insumo con el usuario',
    });
  }
};

const obtenerCertificadosAVencer = async (req, res) => {
  try {
    const { idUsuario } = req.params;
    const userId = parseInt(idUsuario, 10);

    if (Number.isNaN(userId) || userId <= 0) {
      return res.status(400).json({ ok: false, message: 'idUsuario inválido' });
    }

    const sql = `
      SELECT
        me.usuario_id,
        mp.nombre_producto,
        me.extraname,
        me.nombre_calidoc,
        me.fechacalidad,
        me.aviso,
        CASE
          WHEN me.fechacalidad >= CURDATE() THEN 'vigente'
          ELSE 'vencido'
        END AS estado,
        DATEDIFF(me.fechacalidad, CURDATE()) AS dias_restantes
      FROM materia_empresa AS me
      INNER JOIN materias_primas AS mp ON mp.id = me.materia_id
      INNER JOIN empresa_tercero AS et ON mp.fabricante = et.id
      INNER JOIN usuario AS u ON me.usuario_id = u.id
      WHERE
        me.estado = 'APROBADO'
        AND me.requiere = 'SI'
        AND me.fechacalidad != '0000-00-00'
        AND u.id = ?
      ORDER BY me.fechacalidad ASC, mp.nombre_producto ASC
    `;

    const [rows] = await pool.query(sql, [userId]);

    // Opcional: normalizar formato de salida (por si querés que el front lo consuma directo)
    const data = rows.map(r => ({
      usuario_id: r.usuario_id,
      producto: r.nombre_producto,
      extraname: r.extraname ?? null,
      certificado: r.nombre_calidoc ?? null,
      fechaExpiracion: r.fechacalidad, 
      aviso: r.aviso ?? null,
      estado: r.estado,                
      dias_restantes: r.dias_restantes, 
    }));

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[obtenerCertificadosAVencer] Error:', err);
    return res.status(500).json({ ok: false, message: 'Error al obtener certificados.' });
  }
};

module.exports = {
  obtenerMateriasPrimas,
  obtenerEstadisticaInsumo,
  obtenerRegistrosInsumo,
  insertarInsumos,
  verEditarInsumo,
  eliminarInsumo,
  obtenerDataEditarInsumo,
  obtenerDataSectorInsumo,
  modificarInsumo,
  agregarItemAUsuario,
  obtenerCertificadosAVencer
};
