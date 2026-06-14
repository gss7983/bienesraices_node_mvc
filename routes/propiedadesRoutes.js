import express from "express";
import {
  admin,
  crear,
  guardar,
  editar,
  guardarCambios,
  eliminar,
  cambiarEstado,
  agregarImagen,
  validarPropiedadPendiente,
  subirImagen,
  mostrarPropiedad,
  enviarMensaje,
  verMensajes,
  marcarMensajeLeido,
} from "../controllers/propiedadController.js";
import { protegerRuta } from "../middleware/protegerRuta.js";
import upload, { manejarErrorSubida } from "../middleware/subirImagen.js";
import identificarUsuario from "../middleware/identificarUsuario.js";

const router = express.Router();

// Rutas privadas para administrar las propiedades del usuario autenticado.
router.get("/mis-propiedades", protegerRuta, admin);
router.get("/propiedades/crear", protegerRuta, crear);
router.post("/propiedades/crear", protegerRuta, guardar);
router.get("/propiedades/editar/:id", protegerRuta, editar);
router.post("/propiedades/editar/:id", protegerRuta, guardarCambios);
// El mismo endpoint funciona como formulario tradicional y mediante fetch.
router.post("/propiedades/estado/:id", protegerRuta, cambiarEstado);
router.post("/propiedades/eliminar/:id", protegerRuta, eliminar);
router.get(
  "/propiedades/agregar-imagen/:id",
  protegerRuta,
  validarPropiedadPendiente,
  agregarImagen,
);
router.post(
  "/propiedades/agregar-imagen/:id",
  protegerRuta,
  validarPropiedadPendiente,
  upload.single("imagen"),
  manejarErrorSubida,
  subirImagen,
);

// Ruta publica. El middleware identifica al visitante cuando existe una sesion,
// pero permite continuar normalmente cuando no esta autenticado.
router.get("/propiedad/:id", identificarUsuario, mostrarPropiedad);
router.post("/propiedad/:id", identificarUsuario, enviarMensaje);

// Bandeja privada de una propiedad. El controlador tambien valida que el
// anuncio pertenezca al usuario autenticado antes de mostrar sus mensajes.
router.get("/mensajes/:id", protegerRuta, verMensajes);
router.post("/mensajes/:id/leido", protegerRuta, marcarMensajeLeido);

export default router;
