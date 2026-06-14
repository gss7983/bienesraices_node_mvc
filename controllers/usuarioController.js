import { check, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import Usuario from "../models/Usuario.js";
import { emailRegistro, emailOlvidePassword } from "../helpers/emails.js";
import { generarJWT, generarId } from "../helpers/tokens.js";

// Cargamos las variables de entorno en este controlador.
// Esto asegura que JWT_SECRET este disponible cuando se firme el token.
dotenv.config({ path: ".env" });

const COOKIE_RETORNO = "_returnTo";

// Acepta unicamente rutas internas de propiedades.
// Esto evita que un parametro manipulado redirija hacia un sitio externo.
const validarRutaRetorno = (valor) => {
  if (
    typeof valor !== "string" ||
    !valor.startsWith("/") ||
    valor.startsWith("//")
  ) {
    return null;
  }

  try {
    const url = new URL(valor, "http://localhost");

    if (!/^\/propiedad\/[a-f0-9-]+$/i.test(url.pathname)) {
      return null;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
};

// Conserva durante el registro y la confirmacion la propiedad que motivó
// al visitante a crear su cuenta.
const guardarRutaRetorno = (req, res) => {
  const rutaRetorno = validarRutaRetorno(req.query.returnTo);

  if (rutaRetorno) {
    res.cookie(COOKIE_RETORNO, rutaRetorno, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  return rutaRetorno;
};

// Renderiza el formulario de registro.
// Centralizamos esta funcion para no olvidar enviar csrfToken, errores y usuario.
const renderRegistro = (req, res, opciones = {}) => {
  const { errores = [], usuario = {} } = opciones;

  return res.render("auth/registro", {
    pagina: "Crear Cuenta",
    csrfToken: req.csrfToken(),
    errores,
    usuario,
  });
};

// Renderiza el formulario para solicitar recuperacion de password.
// Centralizamos csrfToken y errores para evitar duplicacion.
const renderOlvidePassword = (req, res, opciones = {}) => {
  const { errores = [], usuario = {} } = opciones;

  return res.render("auth/olvide-password", {
    pagina: "Recuperar Password",
    csrfToken: req.csrfToken(),
    errores,
    usuario,
  });
};

// Renderiza el formulario donde el usuario escribe su nuevo password.
const renderResetPassword = (req, res, opciones = {}) => {
  const { errores = [] } = opciones;
  const { token } = req.params;

  return res.render("auth/reset-password", {
    pagina: "Restablece tu Password",
    csrfToken: req.csrfToken(),
    errores,
    token,
  });
};

// Renderiza el formulario de login.
// Lo centralizamos para reutilizar csrfToken, errores y los datos escritos.
const renderLogin = (req, res, opciones = {}) => {
  const { errores = [], usuario = {} } = opciones;

  return res.render("auth/login", {
    autenticado: false,
    pagina: "Iniciar Sesion",
    csrfToken: req.csrfToken(),
    errores,
    usuario,
  });
};

// Muestra el formulario de login.
const formularioLogin = (req, res) => {
  guardarRutaRetorno(req, res);
  return renderLogin(req, res);
};

// Procesa el formulario de login.
// En este punto del curso solo comprobamos credenciales; aun no redirigimos.
const autenticar = async (req, res) => {
  const { email, password } = req.body;

  // Validamos que el formulario tenga datos correctos antes de buscar en MySQL.
  await check("email")
    .trim()
    .notEmpty()
    .withMessage("El correo electronico es obligatorio")
    .bail()
    .isEmail()
    .withMessage("Eso no parece un email")
    .run(req);

  await check("password")
    .notEmpty()
    .withMessage("El password es obligatorio")
    .bail()
    .run(req);

  const resultado = validationResult(req);

  // Si hay errores, renderizamos de nuevo la vista y conservamos lo escrito.
  if (!resultado.isEmpty()) {
    return renderLogin(req, res, {
      errores: resultado.array(),
      usuario: {
        email,
      },
    });
  }

  // Comprobar si el usuario existe
  const usuario = await Usuario.findOne({ where: { email } });

  if (!usuario) {
    return renderLogin(req, res, {
      errores: [{ msg: "El usuario no existe" }],
      usuario: {
        email,
      },
    });
  }

  // Comprobar si el usuario esta comprobado
  if (!usuario.confirmado) {
    return renderLogin(req, res, {
      errores: [{ msg: "Tu cuenta no ha sido confirmada" }],
      usuario: {
        email,
      },
    });
  }

  // Revisar el password
  const passwordValido = await usuario.verificarPassword(password);

  if (!passwordValido) {
    return renderLogin(req, res, {
      errores: [{ msg: "El password es incorrecto" }],
      usuario: {
        email,
      },
    });
  }

  // Autenticar al usuario.
  // Generamos un JWT con informacion minima del usuario.
  // La firma usa JWT_SECRET desde .env para no dejar secretos en el codigo.

  const token = generarJWT({ id: usuario.id, nombre: usuario.nombre });

  // Si el usuario llegó desde un anuncio, vuelve a esa propiedad para enviar
  // el mensaje. En un login normal conserva el acceso al panel privado.
  const rutaRetorno =
    validarRutaRetorno(req.cookies?.[COOKIE_RETORNO]) || "/mis-propiedades";

  res.cookie("_token", token, {
    httpOnly: true,
    // secure: true se activara cuando usemos HTTPS en produccion.
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.clearCookie(COOKIE_RETORNO);

  return res.redirect(rutaRetorno);
};

// Muestra el formulario de registro.
const formularioRegistro = (req, res) => {
  guardarRutaRetorno(req, res);
  return renderRegistro(req, res);
};

// Procesa el formulario de registro y crea un usuario en la base de datos.
const registrar = async (req, res) => {
  // Obtenemos unicamente los campos que esperamos desde el formulario.
  // Esto evita guardar datos no deseados que pudieran venir en req.body.
  const { nombre, email, password, repetir_password } = req.body;

  // Validaciones del registro.
  // Las mantenemos en el controlador para que la ruta solo se encargue de dirigir
  // la peticion y este archivo concentre la logica del formulario.
  await check("nombre")
    .trim()
    .notEmpty()
    .withMessage("El nombre es obligatorio")
    .run(req);

  await check("email")
    .trim()
    .notEmpty()
    .withMessage("El correo electronico es obligatorio")
    .bail()
    .isEmail()
    .withMessage("Eso no parece un email")
    .run(req);

  await check("password")
    .notEmpty()
    .withMessage("El password es obligatorio")
    .bail()
    .isLength({ min: 8 })
    .withMessage("El password debe tener al menos 8 caracteres")
    .run(req);

  await check("repetir_password")
    .notEmpty()
    .withMessage("Repetir el password es obligatorio")
    .bail()
    .custom((value) => {
      if (value !== password) {
        throw new Error("Los passwords no son iguales");
      }

      return true;
    })
    .run(req);

  // Leemos los errores generados por express-validator.
  const resultado = validationResult(req);

  // Si hay errores, renderizamos de nuevo la vista y conservamos lo escrito.
  if (!resultado.isEmpty()) {
    return renderRegistro(req, res, {
      errores: resultado.array(),
      usuario: {
        nombre,
        email,
      },
    });
  }

  try {
    // Verificamos si ya existe un usuario con ese correo.
    const existeUsuario = await Usuario.findOne({ where: { email } });

    if (existeUsuario) {
      return renderRegistro(req, res, {
        errores: [{ msg: "El usuario ya esta registrado" }],
        usuario: {
          nombre,
          email,
        },
      });
    }

    // Generamos el token antes de crear el usuario.
    // Asi podemos guardarlo en la base de datos y tambien enviarlo a la vista.
    const token = generarId();

    // Creamos el usuario.
    // El modelo se encarga de convertir el password a hash con bcrypt.
    // El token se guarda para usarlo despues en la verificacion de cuenta.
    const usuario = await Usuario.create({
      nombre,
      email,
      password,
      token,
    });

    // Enviamos el email de confirmacion.
    // En desarrollo el correo llegara a Mailtrap.
    await emailRegistro({
      nombre: usuario.nombre,
      email: usuario.email,
      token: usuario.token,
    });

    // Mostramos una pagina de mensaje.
    // El enlace real de confirmacion se envia por email.
    // Importante: usamos return para terminar la respuesta aqui.
    // No debemos hacer res.render y res.redirect en la misma peticion.
    return res.render("templates/mensaje", {
      pagina: "Cuenta creada correctamente",
      mensaje:
        "Hemos enviado un email de confirmacion. Revisa tu correo para activar tu cuenta.",
      enlace: "/auth/login",
      textoEnlace: "Ir a Iniciar Sesion",
    });
  } catch (error) {
    console.error(error);

    return renderRegistro(req, res, {
      errores: [{ msg: "No se pudo crear el usuario" }],
      usuario: {
        nombre,
        email,
      },
    });
  }
};

// Confirma una cuenta usando el token recibido en la URL.
const confirmar = async (req, res) => {
  const { token } = req.params;

  try {
    // Buscamos un usuario que tenga exactamente el token recibido.
    // Si no existe, el token es invalido, ya fue usado o fue modificado.
    const usuario = await Usuario.findOne({ where: { token } });

    if (!usuario) {
      return res.render("auth/confirmar-cuenta", {
        pagina: "Error al confirmar tu cuenta",
        mensaje: "El enlace de confirmacion no es valido o ya fue utilizado.",
        error: true,
      });
    }

    // Confirmamos la cuenta.
    // Borramos el token para que el mismo enlace no pueda usarse otra vez.
    usuario.token = null;
    usuario.confirmado = true;
    await usuario.save();

    return res.render("auth/confirmar-cuenta", {
      pagina: "Cuenta confirmada",
      mensaje: "Tu cuenta se confirmo correctamente. Ya puedes iniciar sesion.",
      error: false,
    });
  } catch (error) {
    console.error(error);

    return res.render("auth/confirmar-cuenta", {
      pagina: "Error al confirmar tu cuenta",
      mensaje: "Hubo un error al confirmar tu cuenta. Intentalo mas tarde.",
      error: true,
    });
  }
};

// Muestra el formulario para recuperar password.
const formularioOlvidePassword = (req, res) => {
  return renderOlvidePassword(req, res);
};

const resetPassword = async (req, res) => {
  const { email } = req.body;

  // Validamos que el usuario escriba un email valido.
  await check("email")
    .trim()
    .notEmpty()
    .withMessage("El correo electronico es obligatorio")
    .bail()
    .isEmail()
    .withMessage("Eso no parece un email")
    .run(req);

  const resultado = validationResult(req);

  if (!resultado.isEmpty()) {
    return renderOlvidePassword(req, res, {
      errores: resultado.array(),
      usuario: {
        email,
      },
    });
  }

  const usuario = await Usuario.findOne({ where: { email } });

  if (!usuario) {
    return renderOlvidePassword(req, res, {
      errores: [{ msg: "El email no pertenece a ningún usuario" }],
      usuario: {
        email,
      },
    });
  }

  // Generar un token y enviar el email
  usuario.token = generarId();
  await usuario.save();

  // Enviar un email
  await emailOlvidePassword({
    email: usuario.email,
    nombre: usuario.nombre,
    token: usuario.token,
  });
  //Renderizar un mensaje
  return res.render("templates/mensaje", {
    pagina: "Restablecer Password",
    mensaje: "Hemos enviado un email con las instrucciones",
    enlace: "/auth/login",
    textoEnlace: "Ir a Iniciar Sesion",
  });
};

const comprobarToken = async (req, res) => {
  const { token } = req.params;
  const usuario = await Usuario.findOne({ where: { token } });

  if (!usuario) {
    return res.render("auth/confirmar-cuenta", {
      pagina: "Restablece tu Password",
      mensaje: "Hubo un error al validar tu informacion, intentalo mas tarde",
      error: true,
    });
  }

  // Mostrar formulario para modificar el password
  return renderResetPassword(req, res);
};

const nuevoPassword = async (req, res) => {
  const { token } = req.params;

  // Validar el password
  await check("password")
    .notEmpty()
    .withMessage("El password es obligatorio")
    .bail()
    .isLength({ min: 8 })
    .withMessage("El password debe ser de al menos 8 caracteres")
    .run(req);

  const resultado = validationResult(req);

  if (!resultado.isEmpty()) {
    return renderResetPassword(req, res, {
      errores: resultado.array(),
    });
  }

  const { password } = req.body;

  // Identificar quien hace el cambio
  const usuario = await Usuario.findOne({ where: { token } });

  if (!usuario) {
    return res.render("auth/confirmar-cuenta", {
      pagina: "Restablece tu Password",
      mensaje: "Hubo un error al validar tu informacion, intentalo mas tarde",
      error: true,
    });
  }

  // Hashear el nuevo password
  const salt = await bcrypt.genSalt(10);
  usuario.password = await bcrypt.hash(password, salt);
  usuario.token = null;

  await usuario.save();

  return res.render("auth/confirmar-cuenta", {
    pagina: "Password Restablecido",
    mensaje: "El password se guardo correctamente",
    error: false,
  });
};

// Cierra la sesion del usuario eliminando la cookie que contiene el JWT.
const cerrarSesion = (req, res) => {
  // clearCookie utiliza las mismas opciones relevantes con las que se crearon
  // las cookies para asegurar que el navegador elimine la instancia correcta.
  res.clearCookie("_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  res.clearCookie(COOKIE_RETORNO, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.redirect("/");
};

export {
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
};
