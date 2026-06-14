import express from "express";
import { propiedades } from "../controllers/apiController.js";

const router = express.Router();

// Endpoint publico consumido por el mapa de la pagina de inicio.
router.get("/propiedades", propiedades);

export default router;
