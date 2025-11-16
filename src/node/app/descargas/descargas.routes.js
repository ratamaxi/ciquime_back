const express = require("express");
const router = express.Router();
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
  obtenerCertificadosCalidad
} = require("./descargas.controller");

router.get('/data/:idUsuario', obtenerMateriasPrimas);
router.get('/sga/:materiaId/peligros',      sgaPeligros);
router.get('/sga/:materiaId/epp',           sgaEppComposicion);
router.get('/sga/:materiaId/nfpa',          sgaNfpaTransporte);
router.get('/sga/:materiaId/tratamiento',   sgaTratamiento);
router.get('/sga/:materiaId/emergencia',    sgaEmergencia);
router.get('/sga/:materiaId/almacenamiento',sgaAlmacenamiento);
router.get('/sga/:materiaId', sgaByTab);
router.get('/pais/:id', obtenerPais);
router.get('/etiquetas/menos-3l/:materiaId', obtenerEtiqueta3L);
router.get('/legacy/etiquetas/:tipo/:materiaId', redirectEtiquetaByTipo);
router.post('/certificados/calidad', obtenerCertificadosCalidad);

module.exports = router;
