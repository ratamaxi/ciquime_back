const express = require("express");
const router = express.Router();
const multer  = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '..', 'uploads', 'doc_calidad');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Conserva parte del nombre original y agrega timestamp
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).slice(0, 80).replace(/\s+/g,'_');
    cb(null, `${base}__${Date.now()}${ext}`);
  }
});

const upload  = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    // si querés restringir a PDFs
    if (!/pdf$/i.test(file.mimetype)) return cb(new Error('Solo PDF'));
    cb(null, true);
  }
});

const {
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
} = require("./descargas.controller");

router.get('/data/:idUsuario', obtenerMateriasPrimas);
router.get('/sga/:materiaId/peligros',       sgaPeligros);
router.get('/sga/:materiaId/epp',            sgaEppComposicion);
router.get('/sga/:materiaId/nfpa',           sgaNfpaTransporte);
router.get('/sga/:materiaId/tratamiento',    sgaTratamiento);
router.get('/sga/:materiaId/emergencia',     sgaEmergencia);
router.get('/sga/:materiaId/almacenamiento', sgaAlmacenamiento);
router.get('/sga/:materiaId',                sgaByTab);
router.get('/pais/:id',                       obtenerPais);
router.get('/etiquetas/menos-3l/:materiaId',  obtenerEtiqueta3L);
router.get('/legacy/etiquetas/:tipo/:materiaId', redirectEtiquetaByTipo);
router.post('/certificados/calidad', obtenerCertificadosCalidad);
router.post(
  '/certificados-calidad/editar',
  upload.fields([{ name: 'doc1', maxCount: 1 }, { name: 'doc2', maxCount: 1 }]),
  editarCertificadosCalidad
);

module.exports = router;
