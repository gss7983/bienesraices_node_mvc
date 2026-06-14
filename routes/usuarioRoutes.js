import express from "express";
import {
  formularioLogin,
  autenticar,
  formularioRegistro,
  registrar,
  confirmar,
  formularioOlvidePassword,
  resetPassword,
  comprobarToken,
  nuevoPassword,
  cerrarSesion,
} from "../controllers/usuarioController.js";

const router = express.Router();

// Muestra el formulario para iniciar sesion.
router.get("/login", formularioLogin);
router.post("/login", autenticar);
// Cerrar sesión modifica el estado del usuario, por eso utiliza POST y CSRF.
router.post("/logout", cerrarSesion);

// Muestra el formulario para crear una cuenta.
router.get("/registro", formularioRegistro);

// Recibe los datos del formulario de registro y crea el usuario.
// La ruta solo conecta la URL con el controlador.
// Las validaciones del registro viven en usuarioController.js.
router.post("/registro", registrar);

// Confirma la cuenta del usuario usando el token enviado por email.
router.get("/confirmar/:token", confirmar);

// Muestra el formulario para recuperar password.
router.get("/olvide-password", formularioOlvidePassword);
router.post("/olvide-password", resetPassword);

// Almacena el nuevo password
router.get("/olvide-password/:token", comprobarToken);
router.post("/olvide-password/:token", nuevoPassword);

export default router;
