const pool = require('../../core/database/mysql-config.js');
const { response } = require('express');
 const isNumId = v => /^\d+$/.test(String(v || ''));
const badReq = (res, msg = 'Parámetros inválidos') => res.status(400).json({ ok: false, message: msg });
const srvErr = (res, e, where) => { console.error(`[SGA ${where}]`, e); return res.status(500).json({ ok: false, message: 'Error del servidor' }); };
const { encryptIdCompatEtiqueta } = require('../utils/crypto-legacy.js');
const LEGACY_BASE_URL = process.env.LEGACY_BASE_URL || 'https://ciquime.com.ar';
const LEGACY_KEY = process.env.LEGACY_KEY;
const msPerDay = 24 * 60 * 60 * 1000;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const SCRIPT_BY_TIPO = {
  '3l': 'ketiqueta.php', 
  '50l': 'cetiqueta.php',
  '500l': 'netiqueta.php',
  'mas500l': 'petiqueta.php',
  'cartel': 'etiquetas.php',
 'xs': 'genos/etiquetas/QR_EXSML.php',
  's' : 'genos/etiquetas/QR_SML.php',
  'm' : 'genos/etiquetas/QR_MID.php',
  'l' : 'genos/etiquetas/QR_LRG.php',
  'xl': 'genos/etiquetas/QR_XL.php',
};

function buildLegacyUrl(script, materiaId, useGenosPrefix = false) {
  const enc = encryptIdCompatEtiqueta(String(materiaId), LEGACY_KEY);
  const idParam = encodeURIComponent(enc);

  const prefix = useGenosPrefix ? '/genos/etiquetas' : '';
  return `${LEGACY_BASE_URL}${prefix}/${script}?id=${idParam}`;
}

async function redirectEtiquetaByTipo(req, res) {
  try {
    const { tipo, materiaId } = req.params;
    const idNum = Number(materiaId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return res.status(400).json({ ok: false, message: 'materiaId inválido' });
    }

    const script = SCRIPT_BY_TIPO[tipo];
    if (!script) {
      return res.status(400).json({ ok: false, message: `Tipo desconocido: ${tipo}` });
    }

    const url = buildLegacyUrl(script, idNum);
    return res.redirect(302, url);
  } catch (e) {
    console.error('[redirectEtiquetaByTipo]', e);
    return res.status(500).json({ ok: false, message: 'Error al generar etiqueta' });
  }
}

async function getMateriaBase(materiaId) {
  const sql = `
    SELECT mp.*, et.razonSocial
    FROM materias_primas mp
    LEFT JOIN empresa_tercero et ON mp.fabricante = et.id
    WHERE mp.id = ?`;
  const [rows] = await pool.query(sql, [Number(materiaId)]);
  return rows?.[0] || null;
}
const getHSet = (row) => ['H01','H02','H03','H04','H05','H06','H07','H08','H09','H10']
  .map(k => row?.[k]).filter(Boolean);

async function getFrasesHSpanish(hSet) {
  if (!hSet.length) return [];
  const [rows] = await pool.query(
    `SELECT frase, espaniol FROM ghs_frases_h WHERE frase IN (${hSet.map(() => '?').join(',')})`,
    hSet
  );
  const map = new Map(rows.map(r => [r.frase, r.espaniol]));
  return hSet.map(h => ({ frase: h, espaniol: map.get(h) || '' }));
}
async function getPFromHList(hList) {
  if (!hList.length) return [];
  const [rows] = await pool.query(
    `SELECT frase_p1,frase_p2,frase_p3,frase_p4,frase_p5,frase_p6,frase_p7,frase_p8,frase_p9,frase_p10
     FROM ghs WHERE frase_h1 IN (${hList.map(() => '?').join(',')})`,
    hList
  );
  const out = [];
  for (const r of rows) Object.values(r).forEach(v => { if (v && v !== 'P0') out.push(v); });
  return [...new Set(out)];
}
async function translateP(frasesP) {
  if (!frasesP.length) return {};
  const [rows] = await pool.query(
    `SELECT frase, espaniol FROM ghs_frases_p WHERE frase IN (${frasesP.map(() => '?').join(',')})`,
    frasesP
  );
  return rows.reduce((acc, r) => (acc[r.frase] = r.espaniol, acc), {});
}
async function getIPelAndDP(hSet) {
  if (!hSet.length) return { rango_p: null, descripcion_p: null };
  const [[minRow]] = await pool.query(
    `SELECT MIN(rango_p) AS rango_p FROM categoria_p WHERE frases IN (${hSet.map(() => '?').join(',')})`,
    hSet
  );
  const rango = minRow?.rango_p || null;
  if (!rango) return { rango_p: null, descripcion_p: null };
  const [[dpRow]] = await pool.query(
    `SELECT MIN(descripcion_p) AS dp FROM categoria_p
     WHERE rango_p = ? AND frases IN (${hSet.map(() => '?').join(',')})`,
    [rango, ...hSet]
  );
  return { rango_p: rango, descripcion_p: dpRow?.dp || null };
}

const obtenerMateriasPrimas = async (req, res) => {
  try {
    const { idUsuario } = req.params;
    const userId = parseInt(idUsuario, 10);

    if (Number.isNaN(userId)) {
      return res.status(400).json({ ok: false, message: 'idUsuario inválido' });
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
      WHERE me.estado = 'APROBADO'
        AND me.usuario_id = ?
        AND fd.fds_fundamental = 1
      ORDER BY mp.nombre_producto ASC, fd.FDS_fecha DESC
    `;

    const [rows] = await pool.query(sql, [userId]);

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('Error en obtenerMateriasPrimas:', err);
    return res.status(500).json({ ok: false, message: 'Error al obtener materias primas' });
  }
};

const sgaPeligros = async (req, res) => {
  try {
    const { materiaId } = req.params;
    if (!isNumId(materiaId)) return badReq(res);

    const mp = await getMateriaBase(materiaId);
    if (!mp) return res.json({ ok: true, data: null });

    const hSet = getHSet(mp);
    const frasesH = await getFrasesHSpanish(hSet);
    const expandedH = [...new Set(hSet.flatMap(h => h.split('+').filter(Boolean)))];
    const frasesP = await getPFromHList(expandedH);
    const pMap = await translateP(frasesP);
    const { rango_p, descripcion_p } = await getIPelAndDP(hSet);

    const pictogramas = [];
    for (let k = 1; k <= 5; k++) {
      const code = mp[`pictograma${k}`];
      if (code) pictogramas.push(code);
    }

    return res.json({
      ok: true,
      data: {
        header: {
          nombre_producto: mp.nombre_producto,
          razonSocial: mp.razonSocial,
          iPel: rango_p,
          iPelDescripcion: descripcion_p
        },
        pictogramas,
        palabra_advertencia: mp.palabra_advertencia || null,
        frasesH,
        consejosPrudencia: frasesP.map(p => ({ frase: p, espaniol: pMap[p] || '' }))
      }
    });
  } catch (e) { return srvErr(res, e, 'peligros'); }
};

// ───────────── SGA: EPP y Composición (tab 2) ─────────────
const sgaEppComposicion = async (req, res) => {
  try {
    const { materiaId } = req.params;
    if (!isNumId(materiaId)) return badReq(res);

    const mp = await getMateriaBase(materiaId);
    if (!mp) return res.json({ ok: true, data: null });

    let epp = null;
    if (mp.epp) {
      const [[row]] = await pool.query(
        `SELECT pictograma /*, imagen*/ FROM ghs_pictogramas WHERE pictograma = ?`,
        [mp.epp]
      );
      epp = row || null;
    }

    const [comp] = await pool.query(`
      SELECT ds.nombre_espaniol AS componente, ds.numero_cas AS cas,
             ms.porcentaje, ms.porcentaje2
      FROM materia_sustancia ms
      INNER JOIN datos_sustancias ds ON ms.id_sustancia = ds.id
      WHERE ms.id_materia = ?`,
      [Number(materiaId)]
    );

    return res.json({
      ok: true,
      data: {
        header: { nombre_producto: mp.nombre_producto, razonSocial: mp.razonSocial, rnpqlist: mp.rnpqlist || null },
        epp,
        composicion: comp.map(x => ({
          componente: x.componente,
          cas: x.cas,
          porcentaje: x.porcentaje,
          porcentaje2: x.porcentaje2
        }))
      }
    });
  } catch (e) { return srvErr(res, e, 'eppComposicion'); }
};

// ───────────── SGA: NFPA y Transporte (tab 3) ─────────────
const sgaNfpaTransporte = async (req, res) => {
  try {
    const { materiaId } = req.params;
    if (!isNumId(materiaId)) return badReq(res);

    const mp = await getMateriaBase(materiaId);
    if (!mp) return res.json({ ok: true, data: null });

    let ONU = mp.nro_onu;
    let GE = mp.pg;

    if (ONU === 'NP' && GE === '-') { ONU = '0'; GE = 'NP'; }
    if ((ONU === '0' && (GE === '-' || GE === ''))) { GE = 'NP'; }
    if (GE === '-') GE = '';
    if ((ONU === '3334' || ONU === '3335') && GE === '-') GE = 'NP';

    const [[riesgo]] = await pool.query(
      `SELECT cod_riesgo, clas_img, guia, observacion
       FROM onu_gre2020
       WHERE nro_onu = ? AND pg = ?`,
      [ONU, GE]
    );

    let cod_riesgo = riesgo?.cod_riesgo || null;
    let clas_img = riesgo?.clas_img || '0';
    let guia = riesgo?.guia || null;

    if (ONU === '0' || ONU === '3334' || ONU === '3335') ONU = 'NP';
    if (riesgo?.observacion === 'derogado') {
      clas_img = '0'; cod_riesgo = 'NP'; ONU = 'NP'; GE = 'NP';
    }
    if (['', 'ASF', 'COR', 'CCO', 'INF', 'INC', 'OXI', 'TOX', 'TTC', 'TIN', 'TIC', 'TCO', 'TOC', 'A', 'B', 'C'].includes(GE)) {
      GE = '-';
    } else {
      GE = (GE || '').replace(/[^IVXLDM]/g, '');
    }

    return res.json({
      ok: true,
      data: {
        header: { nombre_producto: mp.nombre_producto, razonSocial: mp.razonSocial, fuente: mp.fuente || null },
        nfpa: { salud: mp.nfpa_az, inflamabilidad: mp.nfpa_ro, reactividad: mp.nfpa_am, otros: mp.nfpa_ba },
        transporte: { cod_riesgo, nro_onu: ONU, grupo_embalaje: GE || 'NP', clas_img, guia }
      }
    });
  } catch (e) { return srvErr(res, e, 'nfpa'); }
};

// ───────────── SGA: Tratamiento (tab 4) ─────────────
const sgaTratamiento = async (req, res) => {
  try {
    const { materiaId } = req.params;
    if (!isNumId(materiaId)) return badReq(res);

    const mp = await getMateriaBase(materiaId);
    if (!mp) return res.json({ ok: true, data: null });

    let clave = mp.tratamiento || null;
    if (!clave) {
      const set = getHSet(mp);
      if (set.some(h => ['H281','H280','H314','H290','H240','H241','H242','H222','H223','H229','H304','H00'].includes(h))) {
        if (set.includes('H281')) clave = 'REFRIGERADOS';
        else if (set.includes('H280')) clave = 'GASES';
        else if (set.some(h => ['H314','H290','H240','H241','H242'].includes(h))) clave = 'CORROSIVOS';
        else if (set.some(h => ['H222','H223','H229'].includes(h))) clave = 'AEROSOL';
        else if (set.includes('H304')) clave = 'HASPIRACION';
        else clave = 'COMUN';
      }
    }
    if (!clave) return res.json({ ok: true, data: null });

    const [[row]] = await pool.query(
      `SELECT tratamiento, medidas_generales, contacto_ojos, contacto_piel, inhalacion, ingestion, nota_medico
       FROM tratamientos_medico WHERE tratamiento = ?`,
      [clave]
    );
    return res.json({ ok: true, data: row || null });
  } catch (e) { return srvErr(res, e, 'tratamiento'); }
};

// ───────────── SGA: Emergencia (tab 5) ─────────────
const sgaEmergencia = async (req, res) => {
  try {
    const { materiaId } = req.params;
    if (!isNumId(materiaId)) return badReq(res);

    const mp = await getMateriaBase(materiaId);
    if (!mp) return res.json({ ok: true, data: null });

    const set = getHSet(mp);
    const hx2 = ["H300","H314","H330","H310","H301","H311","H331"];
    const hx1 = ["H224","H270","H280","H281","H228","H240","H241","H250","H260","H271","H272","H225","H261","H226","H290","H227"];
    const firstHit = arr => arr.find(h => set.includes(h));
    const h2 = firstHit(hx2) || '';
    let h1 = h2 ? firstHit(hx1) || '' : '';

    const invalidCombos = new Set([
      "H290+H300","H270+H314","H270+H310","H250+H310","H290+H310","H224+H330","H250+H330","H225+H330","H226+H330","H290+H330","H227+H330",
      "H270+H301","H228+H301","H240+H301","H241+H301","H250+H301","H260+H301","H271+H301","H272+H301","H261+H301","H290+H301",
      "H240+H311","H270+H311","H228+H311","H241+H311","H250+H311","H260+H311","H271+H311","H272+H311","H261+H311","H290+H311"
    ]);

    let fh = (h1 && h2 && !invalidCombos.has(`${h1}+${h2}`)) ? `${h1}+${h2}` : '';
    if (!fh) {
      const hx0 = ["H202","H203","H204","H205","H220","H222","H224","H240","H241","H242","H221","H223","H225","H300","H310","H314","H330","H301","H311","H331","H290","H226","H304","H302","H312","H332","H335","H336","H337","H303","H313","H333","H400","H401","H410","H411","H360","H361","H362","H370","H371","H372","H373","H227","H00"];
      fh = firstHit(hx0) || 'H00';
    }

    const [[row]] = await pool.query(
      `SELECT incendio, derrames, apropiado, no_apropiado FROM emergencia WHERE fh = ?`,
      [fh]
    );

    return res.json({
      ok: true,
      data: row ? {
        medios_extincion_apropiados: row.apropiado,
        medios_extincion_no_apropiados: row.no_apropiado,
        incendio: row.incendio,
        derrames: row.derrames
      } : null
    });
  } catch (e) { return srvErr(res, e, 'emergencia'); }
};

// ───────────── SGA: Almacenamiento (tab 6) ─────────────
const sgaAlmacenamiento = async (req, res) => {
  try {
    const { materiaId } = req.params;
    if (!isNumId(materiaId)) return badReq(res);

    const mp = await getMateriaBase(materiaId);
    if (!mp) return res.json({ ok: true, data: null });

    const set = getHSet(mp);
    const anyIn = arr => arr.some(h => set.includes(h));

    const ral = {
      1:["H200","H201","H202","H203","H204","H205","H206","H207","H208"],
      2:["H280","H281"], 3:["H220","H221"], 4:["H270","H271","H272"], 5:["H232"],
      6:["H314","H290"], 7:["H330","H331","H332","H301+H331","H310+H330","H311+H331","H300+H310+H330","H301+H311+H331"],
      8:["H250"], 9:["H251","H252"], 10:["H260","H261"], 11:["H229"], 12:["H222","H223"],
      13:["H240","H241","H242","H270","H271","H272"], 14:["H227"], 15:["H228"],
      16:["H224","H225","H226"], 17:["H300","H310","H330","H331","H370","H300+H310","H300+H330","H310+H330","H311+H331","H300+H310+H330"],
      18:["H314","H290"], 19:["H314","H290"],
      20:["H300","H301","H310","H311","H330","H331","H300+H310","H300+H330","H301+H311","H301+H331","H310+H300","H311+H331","H300+H310+H330","H301+H311+H331"],
      21:["H400","H401","H402","H410","H411","H412","H413","H420","H400+H410","H400+H411","H400+H412","H401+H410","H401+H411","H401+H412","H402+H410","H402+H411","H402+H412"],
      22:["H302","H303","H304","H305","H312","H313","H315","H316","H317","H318","H319","H320","H332","H333","H335","H336","H340","H341","H350","H351","H360","H361","H362","H334","H371","H372","H373","H302+H312","H302+H312","H302+H332","H303+H313","H303+H333","H312+H332","H313+H333","H315+H319","H315+H320","H302+H312+H332","H303+H313+H333"],
      23:["H00"]
    };

    let halma = '';
    if (anyIn(ral[1])) halma='1';
    else if (anyIn(ral[2])) { if (anyIn(ral[3])) halma='2'; else if (anyIn(ral[4])) halma='3'; else if (anyIn(ral[5])) halma='4'; else if (anyIn(ral[6])) halma='5'; else if (anyIn(ral[7])) halma='6'; else halma='7'; }
    else if (anyIn(ral[8])) halma='8';
    else if (anyIn(ral[9])) halma='9';
    else if (anyIn(ral[10])) halma='10';
    else if (anyIn(ral[11])) { if (anyIn(ral[12])) halma='11'; else halma='12'; }
    else if (anyIn(ral[13])) halma='13';
    else if (anyIn(ral[14])) halma='14';
    else if (anyIn(ral[15])) halma='15';
    else if (anyIn(ral[16])) { if (anyIn(ral[17])) halma='16'; else if (anyIn(ral[18])) halma='17'; else halma='18'; }
    else if (anyIn(ral[19])) halma='19';
    else if (anyIn(ral[20])) halma='20';
    else if (anyIn(ral[21])) halma='21';
    else if (anyIn(ral[22])) halma='22';
    else if (anyIn(ral[23])) halma='23';

    if (!halma) return res.json({ ok: true, data: null });

    const [[info]] = await pool.query(
      `SELECT descripcion, edilicia, operacion, especifica, almacenamiento, incompatibilidades
       FROM almacenamiento WHERE categoria = ?`,
      [Number(halma)]
    );

    let incompatibles = [];
    if (info?.incompatibilidades) {
      const cats = info.incompatibilidades.split(',').map(s => s.trim()).filter(Boolean);
      if (cats.length) {
        const [rows] = await pool.query(
          `SELECT descripcion FROM almacenamiento WHERE categoria IN (${cats.map(()=>'?').join(',')})`,
          cats
        );
        incompatibles = rows.map(r => r.descripcion);
      }
    }

    return res.json({
      ok: true,
      data: {
        tipo_producto: info?.descripcion || null,
        caracteristicas_deposito: info?.edilicia || null,
        condiciones_operacion: info?.operacion || null,
        disposiciones_particulares: info?.especifica || null,
        disposiciones_almacenamiento: info?.almacenamiento || null,
        incompatible_con: incompatibles
      }
    });
  } catch (e) { return srvErr(res, e, 'almacenamiento'); }
};

// ───────────── (Opcional) Dispatcher con ?tab= ─────────────
const sgaByTab = (req, res) => {
  const tab = String(req.query.tab || '').toLowerCase();
  switch (tab) {
    case 'peligros':       return sgaPeligros(req, res);
    case 'epp':            return sgaEppComposicion(req, res);
    case 'nfpa':           return sgaNfpaTransporte(req, res);
    case 'tratamiento':    return sgaTratamiento(req, res);
    case 'emergencia':     return sgaEmergencia(req, res);
    case 'almacenamiento': return sgaAlmacenamiento(req, res);
    default: return badReq(res, 'tab inválido. Use: peligros|epp|nfpa|tratamiento|emergencia|almacenamiento');
  }
};

const obtenerPais = async (req, res = response) => {
  try {
    const { id } = req.params;
    const empresaId = parseInt(id, 10);

    if (Number.isNaN(empresaId)) {
      return res.status(400).json({ ok: false, message: 'id de empresa inválido' });
    }

    const sql = `
      SELECT pais
      FROM empresa
      WHERE id = ?
      LIMIT 1
    `;
    const [rows] = await pool.query(sql, [empresaId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Empresa no encontrada' });
    }

    const pais = rows[0].pais ?? null;

    return res.json({
      ok: true,
      data: { id: empresaId, pais }
    });
  } catch (err) {
    console.error('Error en obtenerPais:', err);
    return res.status(500).json({ ok: false, message: 'Error al obtener el país de la empresa' });
  }
};

const obtenerEtiqueta3L = async (req, res=response) => {
  try {
    const { materiaId } = req.params;
    const idNum = Number(materiaId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return res.status(400).json({ ok: false, message: 'materiaId inválido' });
    }

    // Encriptar compatible con el PHP (iv+cipher en base64)
    const enc = encryptIdCompatEtiqueta(String(idNum), LEGACY_KEY);
    const url = `${LEGACY_BASE_URL}/ketiqueta.php?id=${encodeURIComponent(enc)}`;
    return res.redirect(302, url);
  } catch (e) {
    console.error('[redirectEtiquetaMenos3L]', e);
    return res.status(500).json({ ok: false, message: 'Error al generar etiqueta' });
  }
}

const obtenerCertificadosCalidad = async (req, res = response) => {
  try {
    const bodyId = Number(req.body?.id_usuario);
    if (!Number.isFinite(bodyId) || bodyId <= 0) {
      return res.status(400).json({ ok: false, message: 'id_usuario inválido' });
    }

    const sql = `
      SELECT
        materia_empresa.usuario_id,
        materias_primas.nombre_producto,
        materia_empresa.extraname,
        materia_empresa.nombre_calidoc,
        materia_empresa.nombre_calidoc2,
        materia_empresa.fechacalidad,
        materia_empresa.fechacalidad2,
        materias_primas.id,
        materia_empresa.aviso
      FROM materia_empresa
      INNER JOIN materias_primas ON materias_primas.id = materia_empresa.materia_id
      INNER JOIN empresa_tercero ON materias_primas.fabricante = empresa_tercero.id
      INNER JOIN usuario ON materia_empresa.usuario_id = usuario.id
      WHERE materia_empresa.estado = 'APROBADO'
        AND materia_empresa.requiere = 'SI'
        AND materia_empresa.fechacalidad <> '0000-00-00'
        AND usuario.id = ?
      ORDER BY materia_empresa.fechacalidad ASC, materias_primas.nombre_producto ASC
    `;

    const [rows] = await pool.query(sql, [bodyId]);
    const today = startOfDay(new Date());
    const data = (rows || []).map((r) => {
      // fechacalidad viene tipo 'YYYY-MM-DD'
      const fechaStr = r.fechacalidad ? String(r.fechacalidad) : null;
      const fechaStr2 = r.fechacalidad2 ? String(r.fechacalidad2) : null;
      let estado = 'desconocido';
      let diasRestantes = null;

      if (fechaStr && fechaStr !== '0000-00-00') {
        const d = startOfDay(fechaStr);
        const diffDays = Math.round((d - today) / msPerDay);
        diasRestantes = diffDays;
        estado = diffDays < 0 ? 'vencido' : 'vigente';
      }

      return {
        usuario_id: r.usuario_id,
        producto: r.nombre_producto,
        extraname: r.extraname ?? null,
        nombre_calidoc: r.nombre_calidoc ?? null,
        nombre_calidoc2: r.nombre_calidoc2 ?? null,
        fechacalidad: fechaStr,
        fechacalidad2: fechaStr2,
        aviso: r.aviso ?? null,
        estado,            
        diasRestantes,
        materia_id: r.id  
      };
    });

    return res.json({ ok: true, data });
  } catch (e) {
    console.error('[obtenerCertificadosCalidad]', e);
    return res.status(500).json({ ok: false, message: 'Error al obtener certificados' });
  }
};

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') return ['1', 'true', 'TRUE', 'on', 'si', 'sí'].includes(v.trim().toLowerCase());
  return false;
}

const editarCertificadosCalidad = async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ ok: false, msj: 'DB pool no inicializado' });
    }
    const {
      materiaId,
      usuarioId,
      cali,                  
      avisoEn,               
      doc1Vencimiento,       
      doc2Vencimiento,       
      oldNombreCalidoc = '',
      oldNombreCalidoc2 = '',
    } = req.body;

    // archivos (multer upload.fields([{ name:'doc1' }, { name:'doc2' }]))
    const doc1File = req.files?.doc1?.[0] || null;
    const doc2File = req.files?.doc2?.[0] || null;

    // nombres finales: si hay archivo nuevo uso su filename, si no, el anterior
    const fileName2 = doc1File ? doc1File.filename : oldNombreCalidoc;
    const fileName3 = doc2File ? doc2File.filename : oldNombreCalidoc2;

    // normalizamos fechas: si viene vacío, mandamos NULL
    const f1 = doc1Vencimiento ? doc1Vencimiento : null;
    const f2 = doc2Vencimiento ? doc2Vencimiento : null;

    // requiere -> cali (1/0)
    const requiere = String(cali) === '1' ? 'SI' : 'NO';
    const aviso = Number(avisoEn) || 30;

    // actualizado (FU en tu PHP): fecha/hora actual
    const FU = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // validaciones mínimas
    const mid = Number(materiaId);
    const uid = Number(usuarioId);
    if (!Number.isFinite(mid) || !Number.isFinite(uid)) {
      return res.status(400).json({ ok: false, msj: 'materiaId/usuarioId inválidos' });
    }

    const sql = `
      UPDATE materia_empresa
      SET
        requiere = ?,                -- 'SI' | 'NO'
        nombre_calidoc = ?,          -- fileName2
        nombre_calidoc2 = ?,         -- fileName3
        fechacalidad = ?,            -- f1
        fechacalidad2 = ?,           -- f2
        aviso = ?,                   -- 30|60|90
        actualizado = ?              -- stamp
      WHERE materia_id = ? AND usuario_id = ?
    `;

    const params = [requiere, fileName2, fileName3, f1, f2, aviso, FU, mid, uid];

    const [result] = await pool.execute(sql, params);

    return res.status(200).json({
      ok: true,
      msj: 'Certificado actualizado',
      affectedRows: result.affectedRows,
      nombre_calidoc: fileName2,
      nombre_calidoc2: fileName3,
      fechacalidad: f1,
      fechacalidad2: f2,
    });
  } catch (err) {
    console.error('[editarCertificadosCalidad]', err);
    return res.status(500).json({ ok: false, msj: 'Error al guardar certificado', detail: err.message });
  }
};



// ───────────── Exports (igual a tu estilo actual) ─────────────
module.exports = {
  obtenerMateriasPrimas,
  sgaPeligros,
  sgaEppComposicion,
  sgaNfpaTransporte,
  sgaTratamiento,
  sgaEmergencia,
  sgaAlmacenamiento,
  sgaByTab,
  obtenerPais,
  obtenerEtiqueta3L,
  redirectEtiquetaByTipo,
  obtenerCertificadosCalidad,
  editarCertificadosCalidad
};