import express from "express";
import {
  inicio,
  categoria,
  noEncontrado,
  buscador,
} from "../controllers/appController.js";

const router = express.Router();

// Pagina publica de inicio.
router.get("/", inicio);

// Listado publico de propiedades pertenecientes a una categoria.
router.get("/categorias/:id", categoria);

// Pagina para categorias o direcciones inexistentes.
router.get("/404", noEncontrado);

// Buscador publico. GET permite conservar el termino en la URL.
router.get("/buscador", buscador);

export default router;
