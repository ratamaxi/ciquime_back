const express = require("express");
const router = express.Router();
const {
  obtenerMateriasPrimas,
  eliminarInsumo,
  modificarInsumo,
  obtenerEstadisticaInsumo,
  obtenerRegistrosInsumo,
  obtenerDataSectorInsumo,
  insertarInsumos,
  verEditarInsumo,
  obtenerDataEditarInsumo,
  agregarItemAUsuario,
  obtenerCertificadosAVencer,
  obtenerSgaConsulta,
  obtenerIpelConsulta,
  obtenerRegistrosInsumoPrivado
} = require("./registros.controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const FDS_DIR = process.env.FDS_DIR; 

if (!FDS_DIR) throw new Error("FDS_DIR no definida");
fs.mkdirSync(FDS_DIR, { recursive: true }); 

const storageFds = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FDS_DIR),
  filename: (req, file, cb) => {
    const safe = path
      .basename(file.originalname)
      .replace(/[\/\\:?*"<>|]/g, "_");
    cb(null, safe); 
  },
});

const uploadFds = multer({
  storage: storageFds,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf")
      return cb(new Error("Solo PDF"), false);
    cb(null, true);
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.get("/data/:idUsuario", obtenerMateriasPrimas);
router.get("/obtener/certificados/:idUsuario", obtenerCertificadosAVencer);
router.get("/estadistica/:idUsuario", obtenerEstadisticaInsumo);
router.get("/ver/editar/insumo/:idUsuario/:estado", verEditarInsumo);
router.get("/registros/:idUsuario", obtenerRegistrosInsumo);
router.get("/registros/privado/:idUsuario/:idFabricante", obtenerRegistrosInsumoPrivado);
router.get("/sga/:idUsuario", obtenerSgaConsulta);
router.get("/ipel/:idInsumo", obtenerIpelConsulta);
router.get(
  "/data/editar/insumo/:matempresa/:empresa_id/:usuario_id",
  obtenerDataEditarInsumo
);
router.get("/data/sector/insumo/:empresa_id", obtenerDataSectorInsumo);
router.post("/insertar/insumo/:idUsuario", insertarInsumos);
router.post(
  "/insumo/:idUsuario",
  uploadFds.single("archivoFds"),
  insertarInsumos
);
router.post("/eliminar/insumo", eliminarInsumo);
router.post("/agregar/insumo/usuario", agregarItemAUsuario);
router.put("/modificar/insumo/:idUsuario", modificarInsumo);

module.exports = router;
