import jwt from "jsonwebtoken";
import Usuario from "../models/Usuario.js";

// Protege rutas privadas leyendo el JWT guardado en la cookie _token.
// Si el token no existe o no es valido, enviamos al usuario al login.
const protegerRuta = async (req, res, next) => {
  const { _token } = req.cookies;

  if (!_token) {
    return res.redirect("/auth/login");
  }

  try {
    const decoded = jwt.verify(_token, process.env.JWT_SECRET);

    // El scope elimina password, token y otros campos sensibles de la consulta.
    const usuario = await Usuario.scope("eliminarPassword").findByPk(decoded.id);

    if (!usuario) {
      return res.clearCookie("_token").redirect("/auth/login");
    }

    // Guardamos el usuario en req para que los controladores lo puedan usar.
    req.usuario = usuario;

    return next();
  } catch (error) {
    return res.clearCookie("_token").redirect("/auth/login");
  }
};

export { protegerRuta };
